/* pocket menace — hardware layer.
   scroll wheel, side button, accelerometer, camera, mic, speaker, LLM.
   every call is guarded so the game degrades gracefully on desktop. */
window.PM = window.PM || {};

(function () {
  var HW = PM.hw = {
    has: { scroll: false, side: false, accel: false, camera: false, mic: false, llm: true },
    handlers: {},
    crank: { stamps: [], active: false, lastCharge: 0 }
  };

  HW.on = function (ev, fn) {
    (HW.handlers[ev] = HW.handlers[ev] || []).push(fn);
  };
  HW.emit = function (ev, data) {
    var hs = HW.handlers[ev] || [];
    for (var i = 0; i < hs.length; i++) {
      try { hs[i](data); } catch (e) {}
    }
  };

  /* ---------- scroll wheel + side button ---------- */
  HW.initButtons = function () {
    function mark(which) {
      HW.has.scroll = true;
      var now = Date.now();
      var c = HW.crank;
      c.stamps.push(now);
      while (c.stamps.length && now - c.stamps[0] > 1500) c.stamps.shift();
      /* crank: 7+ scroll ticks inside 1.5s */
      if (c.stamps.length >= 7 && now - c.lastCharge > 400) {
        c.lastCharge = now;
        c.active = true;
        HW.emit('crank', { dir: which });
        clearTimeout(c._t);
        c._t = setTimeout(function () { c.active = false; HW.emit('crankEnd'); }, 1200);
      }
      HW.emit(which === 'up' ? 'scrollUp' : 'scrollDown');
    }
    try {
      window.addEventListener('scrollUp', function () { mark('up'); });
      window.addEventListener('scrollDown', function () { mark('down'); });
      window.addEventListener('sideClick', function () { HW.has.side = true; HW.emit('sideClick'); });
      window.addEventListener('longPressStart', function () { HW.emit('longPressStart'); });
      window.addEventListener('longPressEnd', function () { HW.emit('longPressEnd'); });
    } catch (e) {}
    /* desktop fallback: mouse wheel maps to scroll events */
    window.addEventListener('wheel', function (e) {
      mark(e.deltaY < 0 ? 'up' : 'down');
    }, { passive: true });
  };

  /* ---------- accelerometer ---------- */
  var accelCb = null, lastShake = 0, rockBuf = [];
  HW.accel = {
    start: function () {
      try {
        if (!window.creationSensors || !window.creationSensors.accelerometer) return false;
        window.creationSensors.accelerometer.start(function (d) {
          HW.has.accel = true;
          HW._accelFrame(d);
        }, { frequency: 30 });
        return true;
      } catch (e) { return false; }
    },
    stop: function () {
      try { window.creationSensors.accelerometer.stop(); } catch (e) {}
    },
    onMove: function (fn) { accelCb = fn; }
  };

  HW._accelFrame = function (d) {
    var mag = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
    var now = Date.now();
    /* shake: sharp magnitude spike */
    if (mag > 1.9 && now - lastShake > 900) {
      lastShake = now;
      HW.emit('shake', { mag: mag });
    }
    /* rock: rhythmic y oscillation (rocking the r1 like a baby) */
    rockBuf.push({ t: now, y: d.y });
    while (rockBuf.length && now - rockBuf[0].t > 4000) rockBuf.shift();
    if (rockBuf.length > 24) {
      var swings = 0;
      for (var i = 2; i < rockBuf.length; i++) {
        var a = rockBuf[i - 2].y, b = rockBuf[i - 1].y, c = rockBuf[i].y;
        if ((b > a && b > c && b - Math.min(a, c) > 0.35) ||
            (b < a && b < c && Math.max(a, c) - b > 0.35)) swings++;
      }
      if (swings >= 4 && !HW._rockFired) {
        HW._rockFired = true;
        HW.emit('rock');
        setTimeout(function () { HW._rockFired = false; }, 6000);
      }
    }
    if (accelCb) { try { accelCb(d); } catch (e) {} }
  };

  /* ---------- camera ---------- */
  var videoEl = null, camStream = null;
  HW.camera = {
    ensure: function () {
      if (camStream) return Promise.resolve(true);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return Promise.resolve(false);
      }
      return navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
        .then(function (stream) {
          camStream = stream;
          videoEl = document.createElement('video');
          videoEl.setAttribute('playsinline', '');
          videoEl.muted = true;
          videoEl.srcObject = stream;
          return videoEl.play().then(function () { HW.has.camera = true; return true; });
        })
        .catch(function () { return false; });
    },
    /* capture a frame, return average color + brightness */
    snap: function () {
      return HW.camera.ensure().then(function (ok) {
        if (!ok || !videoEl || videoEl.videoWidth === 0) return null;
        var c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        var g = c.getContext('2d');
        g.drawImage(videoEl, 0, 0, 48, 48);
        var px = g.getImageData(0, 0, 48, 48).data;
        var r = 0, g2 = 0, b = 0, n = px.length / 4;
        for (var i = 0; i < px.length; i += 4) { r += px[i]; g2 += px[i + 1]; b += px[i + 2]; }
        r = Math.round(r / n); g2 = Math.round(g2 / n); b = Math.round(b / n);
        var mx = Math.max(r, g2, b), mn = Math.min(r, g2, b);
        var h = 0;
        if (mx !== mn) {
          var d = mx - mn;
          if (mx === r) h = ((g2 - b) / d) % 6;
          else if (mx === g2) h = (b - r) / d + 2;
          else h = (r - g2) / d + 4;
          h = Math.round(h * 60); if (h < 0) h += 360;
        }
        return {
          r: r, g: g2, b: b,
          hue: h,
          brightness: Math.round((r + g2 + b) / 3),
          css: PM.cssColor(r, g2, b)
        };
      });
    },
    /* cheap ambient-light probe */
    ambient: function () {
      return HW.camera.snap().then(function (s) { return s ? s.brightness : null; });
    }
  };

  /* ---------- mic: loudness only, no recording ---------- */
  var micStream = null, analyser = null, micBuf = null, micOn = false;
  var loudSince = 0, quietSince = Date.now(), spikeAt = 0;
  HW.mic = {
    ensure: function () {
      if (micOn) return Promise.resolve(true);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function (stream) {
          micStream = stream;
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          var ctx = new AC();
          var src = ctx.createMediaStreamSource(stream);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          src.connect(analyser);
          micBuf = new Uint8Array(analyser.frequencyBinCount);
          micOn = true; HW.has.mic = true;
          HW.mic._loop();
          return true;
        })
        .catch(function () { return false; });
    },
    level: function () {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(micBuf);
      var sum = 0;
      for (var i = 0; i < micBuf.length; i++) {
        var v = (micBuf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / micBuf.length); // 0..~0.5
    },
    _loop: function () {
      if (!micOn) return;
      var lv = HW.mic.level();
      var now = Date.now();
      if (lv > 0.22 && now - spikeAt > 4000) { // sudden bang
        spikeAt = now;
        HW.emit('startle', { level: lv });
      } else if (lv > 0.09) {
        if (!loudSince) loudSince = now;
        quietSince = now;
        if (now - loudSince > 2500 && !HW._danceFired) {
          HW._danceFired = true;
          HW.emit('dance', { level: lv });
          setTimeout(function () { HW._danceFired = false; }, 15000);
        }
      } else {
        loudSince = 0;
        if (now - quietSince > 90000) { // long quiet
          quietSince = now;
          HW.emit('calm');
        }
      }
      setTimeout(HW.mic._loop, 400);
    }
  };

  /* ---------- LLM: brain + voice ---------- */
  var llmSeq = 0, llmPending = {};
  HW.llm = {
    ask: function (prompt, timeoutMs) {
      return new Promise(function (resolve) {
        var id = 'q' + (++llmSeq);
        var done = false;
        function finish(val) {
          if (done) return; done = true;
          delete llmPending[id];
          resolve(val);
        }
        llmPending[id] = finish;
        try {
          PluginMessageHandler.postMessage(JSON.stringify({
            message: prompt,
            useLLM: true,
            wantsR1Response: false
          }));
        } catch (e) { finish(null); return; }
        setTimeout(function () { finish(null); }, timeoutMs || 7000);
      });
    },
    /* speak through the r1 speaker. journal=true logs to r1 journal. */
    speak: function (text, journal) {
      try {
        PluginMessageHandler.postMessage(JSON.stringify({
          message: text,
          useLLM: false,
          wantsR1Response: true,
          wantsJournalEntry: !!journal
        }));
      } catch (e) {}
    },
    /* log a line to the r1 journal without speaking */
    journal: function (text) {
      try {
        PluginMessageHandler.postMessage(JSON.stringify({
          message: text,
          useLLM: false,
          wantsR1Response: false,
          wantsJournalEntry: true
        }));
      } catch (e) {}
    },
    /* have the LLM voice a line AS the pet (big moments only by default) */
    voiceLine: function (petName, mood, journal) {
      var prompt = 'You are ' + petName + ', a punk y2k digital pet (imp-bunny/alley-cat/glitch-mouse). ' +
        'Mood: ' + mood + '. Say ONE short line in your voice: lowercase, dry, a little feral, under 12 words. ' +
        'No quotes, no narration, just the line.';
      try {
        PluginMessageHandler.postMessage(JSON.stringify({
          message: prompt,
          useLLM: true,
          wantsR1Response: true,
          wantsJournalEntry: !!journal
        }));
      } catch (e) {}
    }
  };

  window.onPluginMessage = function (data) {
    try {
      var text = null;
      if (data && data.data) {
        try {
          var p = JSON.parse(data.data);
          text = p.line || p.text || p.message || data.data;
        } catch (e) { text = data.data; }
      } else if (data && data.message) {
        text = data.message;
      }
      if (text == null) return;
      /* route to oldest pending ask */
      for (var id in llmPending) {
        llmPending[id](String(text).trim());
        break;
      }
      HW.emit('llmMessage', text);
    } catch (e) {}
  };

  /* pet says something: LLM when online, local pool fallback.
     opts.speak=true forces r1 speaker. */
  HW.petSay = function (pet, mood, opts) {
    opts = opts || {};
    var fallback = PM.pick(PM.LINES[mood] || PM.LINES.idle);
    var el = document.getElementById('speech');
    function show(t) {
      if (!el) return;
      el.textContent = t;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.textContent = ''; }, 5200);
    }
    var shouldSpeak = opts.speak || pet.voice === 'chatty' ||
      (pet.voice === 'big' && opts.big);
    if (shouldSpeak) {
      HW.llm.voiceLine(pet.name, mood, opts.journal);
      show(fallback); // show text immediately, voice follows
      return;
    }
    /* silent LLM line for flavor, fallback instantly on failure */
    var prompt = 'You are ' + pet.name + ', a punk y2k digital pet. Mood: ' + mood + '. ' +
      'Reply with exactly one short lowercase line, dry and a little feral, under 12 words. No quotes.';
    HW.llm.ask(prompt, 5000).then(function (line) {
      show(line || fallback);
    });
  };

  HW.close = function () {
    try { closeWebView.postMessage(''); } catch (e) {}
  };

  HW.init = function () {
    HW.initButtons();
  };
})();
