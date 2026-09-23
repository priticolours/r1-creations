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

  /* ---------- feeding game: food falls from the top, tilt to catch (10s) ---------- */
  UI.tiltGame = function (pet, done) {
    var W = 210, H = 130; // matches #tarea
    var html = '<div class="tilt"><div class="pick-title">catch the snacks!</div>' +
      '<div class="tilt-sub">tilt the r1 · 10 seconds</div>' +
      '<div id="tarea"><div id="catcher">🧺</div></div>' +
      '<div class="tilt-score">caught <span id="tscore">0</span> · <span id="ttime">10</span>s</div></div>';
    UI.overlay(html, 'tilt-ov');
    var area = el('tarea'), catcher = el('catcher');
    var cx = W / 2, cy = H - 20;
    var score = 0, timeLeft = 10, over = false;
    var foods = [];
    var emojis = ['🍩', '🍕', '🧃', '🍪', '🍬', '🍔', '🍇'];
    function drawCatcher() {
      catcher.style.left = (cx - 13) + 'px';
      catcher.style.top = (cy - 13) + 'px';
    }
    function spawn() {
      if (over) return;
      var s = document.createElement('div');
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.cssText = 'position:absolute;font-size:22px;line-height:1;';
      var x = 8 + Math.random() * (W - 30), y = -26;
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      area.appendChild(s);
      foods.push({ el: s, x: x, y: y, v: 80 + Math.random() * 60 }); // px/sec
    }
    /* tilt: SDK x positive = tilt right */
    var onMove = function (d) {
      cx = Math.max(18, Math.min(W - 18, cx + d.x * 4.5));
      drawCatcher();
    };
    PM.hw.accel.onMove(onMove);
    /* desktop fallback: tap left/right half to nudge the basket */
    area.addEventListener('click', function (e) {
      var r = area.getBoundingClientRect();
      cx = Math.max(18, Math.min(W - 18, cx + ((e.clientX - r.left) < W / 2 ? -28 : 28)));
      drawCatcher();
    });
    var last = Date.now();
    var spawnT = setInterval(spawn, 550);
    spawn(); spawn();
    var step = setInterval(function () {
      var now = Date.now(), dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (var i = foods.length - 1; i >= 0; i--) {
        var f = foods[i];
        f.y += f.v * dt;
        if (f.y >= cy - 14 && f.y <= cy + 12 && Math.abs((f.x + 11) - cx) < 28) {
          score++;
          el('tscore').textContent = score;
          f.el.remove(); foods.splice(i, 1);
        } else if (f.y > H + 12) {
          f.el.remove(); foods.splice(i, 1);
        } else {
          f.el.style.top = f.y + 'px';
        }
      }
    }, 33);
    drawCatcher();
    var timer = setInterval(function () {
      timeLeft--;
      var tt = el('ttime');
      if (tt) tt.textContent = timeLeft;
      if (timeLeft <= 0 && !over) {
        over = true;
        clearInterval(timer); clearInterval(step); clearInterval(spawnT);
        PM.hw.accel.onMove(null);
        UI.hideOverlay();
        done(score);
      }
    }, 1000);
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
