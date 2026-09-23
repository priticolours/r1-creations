/* pocket menace — UI: screens, menus, arcade name entry, mini-games.
   all DOM is minimal; animation is transform/opacity only (weak hardware). */
window.PM = window.PM || {};

(function () {
  var UI = PM.ui = {};
  var focusIdx = 0;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- overlays ---------- */
  UI._clearTransient = function () {
    UI._menuItems = null; UI._menuPaint = null; UI._menuChoose = null;
    UI._nameBump = null; UI._nameNext = null;
  };
  UI.overlay = function (html, cls, keep) {
    if (!keep) UI._clearTransient();
    var o = el('overlay');
    o.innerHTML = html || '';
    o.className = 'show ' + (cls || '');
    focusIdx = 0;
    return o;
  };
  UI.hideOverlay = function () {
    UI._clearTransient();
    var o = el('overlay');
    o.className = '';
    o.innerHTML = '';
  };
  UI.isOverlay = function () {
    return el('overlay').className.indexOf('show') >= 0;
  };

  UI.toast = function (msg, ms) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  };

  /* ---------- menu list (scroll = move, tap/side = select) ---------- */
  UI.menu = function (title, items, cb, opts) {
    opts = opts || {};
    var html = '<div class="menu"><div class="menu-title">' + esc(title) + '</div>';
    items.forEach(function (it, i) {
      html += '<div class="menu-item' + (i === 0 ? ' focus' : '') + '" data-i="' + i + '">' +
        (it.icon ? '<span class="mi">' + it.icon + '</span>' : '') +
        '<span class="ml">' + esc(it.label) + '</span>' +
        (it.sub ? '<span class="ms">' + esc(it.sub) + '</span>' : '') + '</div>';
    });
    html += '<div class="menu-hint">scroll = move · tap = pick</div></div>';
    UI.overlay(html, 'menu-ov');
    var items_ = UI._menuItems = items, cb_ = cb;

    function paint() {
      var nodes = el('overlay').querySelectorAll('.menu-item');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('focus', i === focusIdx);
      }
      var f = nodes[focusIdx];
      if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
    }
    UI._menuPaint = paint;

    el('overlay').querySelectorAll('.menu-item').forEach(function (n) {
      n.addEventListener('click', function () {
        var i = +n.getAttribute('data-i');
        UI.hideOverlay();
        cb_(items_[i], i);
      });
    });
    UI._menuChoose = function () {
      var it = items_[focusIdx];
      UI.hideOverlay();
      cb_(it, focusIdx);
    };
  };
  UI.menuMove = function (dir) {
    if (!UI._menuItems) return false;
    focusIdx = (focusIdx + dir + UI._menuItems.length) % UI._menuItems.length;
    if (UI._menuPaint) UI._menuPaint();
    return true;
  };
  UI.menuChoose = function () {
    if (UI._menuChoose) { UI._menuChoose(); return true; }
    return false;
  };

  /* ---------- pick your pet ---------- */
  UI.pickScreen = function (cb) {
    var html = '<div class="pick"><div class="pick-title">pick your menace</div>';
    PM.SPECIES_ORDER.forEach(function (key, i) {
      var sp = PM.SPECIES[key];
      html += '<div class="pick-card' + (i === 0 ? ' focus' : '') + '" data-k="' + key + '">' +
        '<img src="' + sp.sprite('idol') + '" alt="">' +
        '<div class="pick-name">' + esc(sp.defaultName) + ' <span>' + esc(sp.label) + '</span></div>' +
        '<div class="pick-blurb">' + esc(sp.blurb) + '</div></div>';
    });
    html += '<div class="menu-hint">scroll = browse · tap = adopt</div></div>';
    UI.overlay(html, 'pick-ov');
    var cards = el('overlay').querySelectorAll('.pick-card');
    function paint() {
      for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('focus', i === focusIdx);
      var f = cards[focusIdx];
      if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
    }
    UI._menuItems = PM.SPECIES_ORDER.map(function (k) { return { key: k }; });
    UI._menuPaint = paint;
    UI._menuChoose = function () {
      var key = PM.SPECIES_ORDER[focusIdx];
      UI.hideOverlay();
      cb(key);
    };
    cards.forEach(function (n) {
      n.addEventListener('click', function () {
        var key = n.getAttribute('data-k');
        UI.hideOverlay();
        cb(key);
      });
    });
  };

  /* ---------- arcade name entry ---------- */
  UI.nameEntry = function (speciesKey, cb) {
    var sp = PM.SPECIES[speciesKey];
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ-'.split('');
    var name = sp.defaultName.split('');
    while (name.length < 6) name.push('-');
    var pos = 0;
    function render() {
      var html = '<div class="naming"><div class="pick-title">name your ' + esc(sp.label) + '</div>' +
        '<img class="name-sprite" src="' + sp.sprite('baby') + '">' +
        '<div class="name-slots">';
      name.forEach(function (ch, i) {
        html += '<div class="slot' + (i === pos ? ' focus' : '') + '">' + esc(ch) + '</div>';
      });
      html += '</div><div class="menu-hint">scroll = letter · tap = next · ✓ = done</div>' +
        '<div class="name-done">✓ done</div></div>';
      UI.overlay(html, 'name-ov', true);
      el('overlay').querySelector('.name-done').addEventListener('click', finish);
      el('overlay').querySelectorAll('.slot').forEach(function (n, i) {
        n.addEventListener('click', function () {
          pos = i;
          if (pos >= name.length - 1) { finish(); return; }
          pos++;
          render();
        });
      });
    }
    function finish() {
      var n = name.join('').replace(/-+$/g, '').replace(/-/g, '') || sp.defaultName;
      UI._clearTransient();
      UI.hideOverlay();
      cb(n.toUpperCase());
    }
    UI._nameBump = function (dir) {
      var li = letters.indexOf(name[pos]);
      li = (li + dir + letters.length) % letters.length;
      name[pos] = letters[li];
      render();
    };
    UI._nameNext = function () {
      if (pos >= name.length - 1) finish();
      else { pos++; render(); }
    };
    render();
  };

  /* ---------- egg screen ---------- */
  UI.eggScreen = function (pet, onTap) {
    var html = '<div class="eggwrap"><div class="pick-title">a wild egg appeared</div>' +
      '<img id="eggimg" class="egg" src="sprites/egg.png">' +
      '<div class="menu-hint">tap the egg to warm it · or wait</div>' +
      '<div class="eggbar"><div id="eggfill"></div></div></div>';
    UI.overlay(html, 'egg-ov');
    el('eggimg').addEventListener('click', function () {
      var e = el('eggimg');
      e.classList.remove('wob');
      void e.offsetWidth;
      e.classList.add('wob');
      onTap();
    });
  };
  UI.eggProgress = function (pct) {
    var f = el('eggfill');
    if (f) f.style.width = Math.min(100, pct) + '%';
  };

  /* ---------- main render ---------- */
  var BAR_DEFS = [
    ['hunger', '🍖'], ['fun', '🎮'], ['energy', '⚡'], ['clean', '🧼']
  ];
  UI.render = function (s) {
    if (!s || s.stage === 'egg') return;
    var sp = PM.SPECIES[s.species];
    el('petname').textContent = s.name;
    el('petstage').textContent = s.stage === 'adult' ? s.form : s.stage;

    var img = el('pet');
    var want = PM.stageSprite(s);
    if (img.getAttribute('src') !== want) img.setAttribute('src', want);

    /* mood classes */
    img.classList.toggle('sleeping', s.sleeping);
    img.classList.toggle('sick', s.sick);
    img.classList.toggle('hidden-pet', s.sulking);
    el('sulknote').style.display = s.sulking ? 'block' : 'none';

    el('poop').style.display = s.poop ? 'block' : 'none';
    el('zzz').style.display = s.sleeping ? 'block' : 'none';

    /* stat bars */
    var html = '';
    BAR_DEFS.forEach(function (d) {
      var v = Math.round(s.stats[d[0]]);
      var cls = v < 20 ? ' low' : (v < 45 ? ' mid' : '');
      html += '<div class="bar"><span class="bi">' + d[1] + '</span>' +
        '<div class="bt"><div class="bf' + cls + '" style="width:' + v + '%"></div></div></div>';
    });
    el('stats').innerHTML = html;

    /* status dots */
    var dots = '';
    if (s.sick) dots += '🤒';
    if (s.poop) dots += '💩';
    if (s.stats.hunger < 20) dots += '🍽️';
    el('dots').textContent = dots;
  };

  UI.hearts = function () {
    var fx = el('fx');
    for (var i = 0; i < 5; i++) {
      var h = document.createElement('div');
      h.className = 'heart';
      h.textContent = ['💖', '✨', '💜'][i % 3];
      h.style.left = (30 + Math.random() * 40) + '%';
      h.style.animationDelay = (i * 0.12) + 's';
      fx.appendChild(h);
      (function (hh) { setTimeout(function () { hh.remove(); }, 1600); })(h);
    }
  };

  UI.petMood = function (mood, ms) {
    var img = el('pet');
    img.classList.remove('bounce', 'shakeit');
    void img.offsetWidth;
    if (mood === 'dance') img.classList.add('bounce');
    if (mood === 'startle') img.classList.add('shakeit');
    clearTimeout(img._m);
    img._m = setTimeout(function () { img.classList.remove('bounce', 'shakeit'); }, ms || 1800);
  };

  /* ---------- tilt mini-game ---------- */
  UI.tiltGame = function (pet, done) {
    var html = '<div class="tilt"><div class="pick-title">tilt to feed!</div>' +
      '<div class="tilt-sub">roll the treat into the mouth</div>' +
      '<div id="tarea"><div id="treat">🍩</div><div id="mouth">👄</div></div>' +
      '<div class="tilt-score">score <span id="tscore">0</span> · <span id="ttime">25</span>s</div></div>';
    UI.overlay(html, 'tilt-ov');
    var score = 0, tx = 90, ty = 40, mx = 90, my = 96;
    var timeLeft = 25;
    var treat = el('treat'), area = el('tarea');
    var treatEmojis = ['🍩', '🍕', '🧃', '🍪', '🍬'];
    function place() {
      treat.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    }
    function respawn() {
      tx = 10 + Math.random() * 160; ty = 5 + Math.random() * 50;
      treat.textContent = treatEmojis[Math.floor(Math.random() * treatEmojis.length)];
      place();
    }
    respawn();
    /* tap-to-nudge fallback (desktop / no accelerometer) */
    area.addEventListener('click', function (e) {
      var r = area.getBoundingClientRect();
      var cx = e.clientX - r.left - 12, cy = e.clientY - r.top - 12;
      tx += Math.max(-34, Math.min(34, (cx - tx) * 0.6));
      ty += Math.max(-34, Math.min(34, (cy - ty) * 0.6));
      place();
    });
    var onMove = function (d) {
      tx = Math.max(0, Math.min(180, tx + d.x * 6));
      ty = Math.max(0, Math.min(100, ty - d.y * 6));
      place();
      var dx = tx - mx, dy = ty - my;
      if (dx * dx + dy * dy < 500) {
        score++;
        el('tscore').textContent = score;
        PM.hw.petSay(pet, 'happy');
        respawn();
      }
    };
    PM.hw.accel.onMove(onMove);
    var timer = setInterval(function () {
      timeLeft--;
      var tt = el('ttime');
      if (tt) tt.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        PM.hw.accel.onMove(null);
        UI.hideOverlay();
        done(score);
      }
    }, 1000);
    place();
  };

  /* ---------- sleep overlay ---------- */
  UI.sleepPrompt = function (sleeping) {
    if (sleeping) {
      UI.overlay('<div class="sleepov"><div class="pick-title">shhh...</div>' +
        '<div class="bigzzz">💤</div>' +
        '<div class="menu-hint">tap, scroll or shake to wake</div></div>', 'sleep-ov');
      el('overlay').addEventListener('click', function () { PM.game.wake(); });
    } else {
      UI.hideOverlay();
    }
  };

  UI.boot = function (msg) {
    UI.overlay('<div class="boot"><div class="boot-logo">pocket<br>menace</div>' +
      '<div class="boot-sub">' + esc(msg || 'warming up the alley...') + '</div></div>', 'boot-ov');
  };
})();
