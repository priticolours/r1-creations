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
    frames: 0,
    dead: false,
    _started: false,
    start: function () {
      /* retry allowed if a previous attempt died (bridge may inject late) */
      if (HW.accel._started && !HW.accel.dead) return true;
      HW.accel.dead = false;
      HW.accel._started = true;
      var acc = null;
      try { acc = window.creationSensors && window.creationSensors.accelerometer; } catch (e) {}
      if (!acc) { HW.accel.dead = true; return false; }
      function go() {
        if (HW.accel.dead) return;
        try {
          var r = acc.start(function (d) {
            if (!d) return;
            HW.accel.frames++;
            HW.has.accel = true;
            HW._accelFrame(d);
          }, { frequency: 30 });
          /* start() may reject async — a rejection means the sensor is dead */
          if (r && typeof r.catch === 'function') {
            r.catch(function () { HW.accel.dead = true; });
          }
        } catch (e) { HW.accel.dead = true; }
      }
      /* the SDK exposes isAvailable(); some builds need it before start().
         if it hangs or rejects, try start() anyway (optimistic). */
      try {
        if (acc.isAvailable) {
          var settled = false;
          var to = setTimeout(function () {
            if (!settled) { settled = true; go(); }
          }, 2500);
          acc.isAvailable().then(function (ok) {
            if (settled) return; settled = true; clearTimeout(to);
            if (ok) go(); else HW.accel.dead = true;
          }).catch(function () {
            if (settled) return; settled = true; clearTimeout(to); go();
          });
        } else go();
      } catch (e) { go(); }
      return true;
    },
    stop: function () {
      try { window.creationSensors.accelerometer.stop(); } catch (e) {}
    },
    onMove: function (fn) { accelCb = fn; },
    /* true only once real sensor frames have actually arrived */
    live: function () { return HW.accel.frames > 0 && !HW.accel.dead; }
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
  var videoEl = null, camStream = null, camFailed = false, camPromise = null;
  function withTimeout(p, ms, tag) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error('timeout:' + tag)); }, ms);
    })]);
  }
  HW.camera = {
    ensure: function () {
      if (camStream) return Promise.resolve(true);
      if (camFailed) return Promise.resolve(false);
      if (camPromise) return camPromise;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        camFailed = true;
        return Promise.resolve(false);
      }
      function tryGet(constraints) {
        return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
          camStream = stream;
          videoEl = document.createElement('video');
          videoEl.setAttribute('playsinline', '');
          videoEl.setAttribute('autoplay', '');
          videoEl.muted = true;
          videoEl.srcObject = stream;
          /* some webviews only feed frames to attached video elements */
          videoEl.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;';
          document.body.appendChild(videoEl);
          return withTimeout(videoEl.play(), 5000, 'play').then(function () {
            if (videoEl.videoWidth === 0) throw new Error('no frames');
            HW.has.camera = true;
            return true;
          });
        });
      }
      /* never hang: bounded total time, then remember the failure so every
         later call fails fast instead of re-prompting */
      camPromise = withTimeout(
        tryGet({ video: { width: 320, height: 240 }, audio: false })
          .catch(function () { return tryGet({ video: true, audio: false }); }),
        12000, 'camera'
      ).then(function (ok) { return !!ok; })
       .catch(function () { camFailed = true; camPromise = null; return false; });
      return camPromise;
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
  /* Paced speech queue. The r1 speaker gets overrun if we fire messages
     back-to-back, so spoken lines are serialized with breathing room and
     overflow is dropped (latest waiting line wins). ONLY the character's
     own line is ever sent with wantsR1Response — never an instruction
     prompt, so the device can't read our prompts aloud. */
  var speakQ = [], speaking = false, lastSpokeAt = 0;
  function pumpSpeech() {
    if (speaking) return;
    var item = speakQ.shift();
    if (!item) return;
    speaking = true;
    var gap = Math.max(0, 3000 - (Date.now() - lastSpokeAt));
    setTimeout(function () {
      try {
        PluginMessageHandler.postMessage(JSON.stringify({
          message: item.line,
          useLLM: false,
          wantsR1Response: true,
          wantsJournalEntry: !!item.journal
        }));
      } catch (e) {}
      lastSpokeAt = Date.now();
      /* estimated talk time (~60ms/char, min 2.5s): the next line never
         starts before this one has been said aloud */
      var est = Math.max(2500, item.line.length * 60);
      setTimeout(function () { speaking = false; pumpSpeech(); }, est);
    }, gap);
  }
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
    /* queue a literal line for the r1 speaker. any line still waiting is
       replaced, so a burst of events can't pile up into endless talking. */
    sayLine: function (line, journal) {
      line = String(line || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!line) return;
      speakQ[0] = { line: line, journal: !!journal };
      pumpSpeech();
    },
    /* have the LLM voice a line AS the pet: generate silently first, then
       speak ONLY the resulting line — the prompt itself is never spoken. */
    voiceLine: function (pet, mood, opts) {
      opts = opts || {};
      var prompt = 'You are ' + pet.name + ', a punk y2k digital pet. Mood: ' + mood + '. ' +
        'Reply with exactly one short lowercase line, dry and a little feral, under 12 words. ' +
        'No quotes, no narration, just the line itself.';
      HW.llm.ask(prompt, 8000).then(function (line) {
        var spoken = line || PM.pick(PM.LINES[mood] || PM.LINES.idle);
        /* if the model echoed the instructions, fall back to a local line */
        if (/punk y2k|under 12 words|no narration|as an ai/i.test(spoken)) {
          spoken = PM.pick(PM.LINES[mood] || PM.LINES.idle);
        }
        HW.llm.sayLine(spoken, opts.journal);
      });
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
      HW.llm.voiceLine(pet, mood, opts);
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

  /* one-line hardware status for on-device debugging */
  HW.diag = function () {
    return 'accel:' + (HW.accel.live() ? HW.accel.frames + 'f' : 'dead') +
      ' cam:' + (HW.has.camera ? 'ok' : 'no') +
      ' mic:' + (HW.has.mic ? 'ok' : 'no');
  };

  HW.init = function () {
    HW.initButtons();
  };
})();
