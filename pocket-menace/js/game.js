/* pocket menace — game engine: boot flow, main loop, actions, wiring. */
window.PM = window.PM || {};

(function () {
  var G = PM.game = {};
  var pet = null;
  var lastStarveVoice = 0;
  var ambientT = 0;

  /* ---------- speech helper ---------- */
  G.say = function (mood, opts) {
    if (!pet || pet.stage === 'egg') return;
    PM.hw.petSay(pet, mood, opts || {});
  };

  /* ---------- boot ---------- */
  G.boot = function () {
    PM.hw.init();
    PM.ui.boot();
    /* ?demo=1 → instant test pet (handy on-device too) */
    if (/\bdemo=1\b/.test(location.search)) {
      setTimeout(function () {
        pet = PM.newPet('bunny', 'RIOT');
        pet.stage = 'baby';
        G.wire(); G.enterMain(); G.loop();
        PM.ui.toast('demo mode');
      }, 600);
      return;
    }
    PM.loadSaved().then(function (saved) {
      setTimeout(function () {
        if (saved && saved.v === 1) {
          pet = saved;
          G.awayTime();
          if (pet.stage === 'egg') G.eggFlow(true);
          else { G.enterMain(); G.say('wake'); }
        } else {
          PM.ui.pickScreen(function (species) {
            PM.ui.nameEntry(species, function (name) {
              pet = PM.newPet(species, name);
              PM.saveNow(pet);
              PM.hw.llm.journal('pocket menace: adopted a ' +
                PM.SPECIES[species].label + ' named ' + pet.name + '.');
              G.eggFlow(false);
            });
          });
        }
        G.wire();
        G.loop();
      }, 900);
    });
  };

  G.awayTime = function () {
    var mins = Math.min(480, (Date.now() - pet.lastSeen) / 60000);
    if (mins >= 2) {
      var ev = PM.tick(pet, mins * 0.5);
      PM.ui.toast('you were gone ' + Math.round(mins) + 'm...');
      handleEvents(ev);
    }
    pet.lastSeen = Date.now();
  };

  /* ---------- egg flow ---------- */
  var eggStart = 0;
  G.eggFlow = function (resumed) {
    eggStart = Date.now() - (resumed ? Math.min(110000, Date.now() - pet.bornAt) : 0);
    PM.ui.eggScreen(pet, function () {
      pet.eggTaps++;
      if (pet.eggTaps >= 25) G.hatch();
      else { PM.ui.eggProgress(G.eggPct()); PM.saveNow(pet); }
    });
    var iv = setInterval(function () {
      if (!pet || pet.stage !== 'egg') { clearInterval(iv); return; }
      PM.ui.eggProgress(G.eggPct());
      if (Date.now() - eggStart > 120000) G.hatch();
    }, 1000);
  };
  G.eggPct = function () {
    return Math.max(pet.eggTaps / 25 * 100, (Date.now() - eggStart) / 120000 * 100);
  };
  G.hatch = function () {
    pet.stage = 'baby';
    pet.seenHatch = true;
    pet.lastSeen = Date.now();
    PM.saveNow(pet);
    PM.hw.llm.journal('pocket menace: ' + pet.name + ' hatched! a baby ' +
      PM.SPECIES[pet.species].label + '.');
    G.enterMain();
    PM.ui.hearts();
    G.say('hatch', { big: true, speak: pet.voice !== 'off', journal: true });
    PM.ui.toast('🎉 ' + pet.name + ' hatched!');
  };

  /* ---------- main screen ---------- */
  G.enterMain = function () {
    PM.ui.hideOverlay();
    document.getElementById('main').style.display = 'flex';
    PM.ui.render(pet);
    /* lazy hardware: camera + mic warm up in background */
    setTimeout(function () {
      PM.hw.camera.ensure();
      PM.hw.mic.ensure();
      PM.hw.accel.start();
    }, 1500);
  };

  /* ---------- main loop ---------- */
  var saveT = 0;
  G.loop = function () {
    setInterval(function () {
      if (!pet || pet.stage === 'egg') return;
      var ev = PM.tick(pet, 5 / 60); // 5 seconds
      handleEvents(ev);
      PM.ui.render(pet);
      saveT += 5;
      if (saveT >= 30) { saveT = 0; PM.saveNow(pet); }
      ambientT += 5;
      if (ambientT >= 45) { ambientT = 0; G.ambientCheck(); }
    }, 5000);
  };

  function handleEvents(ev) {
    ev.forEach(function (e) {
      switch (e) {
        case 'evolve':
          PM.ui.render(pet);
          PM.ui.hearts();
          PM.ui.toast('✨ evolution! ' + pet.name + ' is now ' +
            (pet.stage === 'adult' ? pet.form : pet.stage) + '!');
          G.say('evolve', { big: true, speak: pet.voice !== 'off', journal: true });
          PM.hw.llm.journal('pocket menace: ' + pet.name + ' evolved into ' +
            (pet.stage === 'adult' ? pet.form + ' adult' : pet.stage) + '.');
          break;
        case 'starving':
          if (Date.now() - lastStarveVoice > 10 * 60000) {
            lastStarveVoice = Date.now();
            G.say('starving', { big: true, speak: pet.voice !== 'off' });
          } else G.say('hungry');
          break;
        case 'hungry': G.say('hungry'); break;
        case 'sleepy': G.say('sleepy'); break;
        case 'poop':
          PM.ui.toast('💩 uh oh. clean it!');
          break;
        case 'sick':
          PM.ui.toast('🤒 ' + pet.name + ' is sick! clean + comfort.');
          G.say('sick');
          break;
        case 'sulk':
          G.say('sulk');
          PM.ui.toast(pet.name + ' is sulking...');
          break;
        case 'unsulk':
          G.say('happy');
          PM.ui.toast(pet.name + ' forgives you.');
          break;
        case 'crash':
          PM.ui.toast('😴 ' + pet.name + ' passed out.');
          G.sleep(true);
          break;
        case 'wake':
          G.sleep(false);
          G.say('wake');
          break;
      }
    });
  }

  /* ---------- actions ---------- */
  function ensureAwake() {
    if (pet.sleeping) { G.wake(); PM.ui.toast('wake up!'); }
  }
  G.feed = function () {
    ensureAwake();
    var items = PM.FOODS.map(function (f) {
      return { label: f.name, sub: '+' + f.hunger + ' 🍖', icon: f.icon, food: f };
    });
    items.push({ label: 'photo feed', sub: 'camera 📷', icon: '📸', photo: true });
    PM.ui.menu('feed ' + pet.name, items, function (it) {
      if (it.photo) { G.photoFeed(); return; }
      var mood = PM.act.feed(pet, it.food);
      PM.ui.render(pet);
      PM.ui.hearts();
      G.say(mood);
      PM.saveNow(pet);
    });
  };

  G.photoFeed = function () {
    ensureAwake();
    PM.ui.toast('📷 show me food...');
    PM.hw.camera.snap().then(function (snap) {
      if (!snap) { PM.ui.toast('camera shy. no photo.'); return; }
      var vibe = PM.mealVibe(snap.hue);
      var mealName = PM.pick(PM.MEAL_NAMES);
      PM.act.photoMeal(pet, vibe);
      PM.ui.render(pet);
      PM.ui.hearts();
      PM.ui.toast('🍽️ ' + mealName + ' (' + vibe + ')');
      var chip = document.getElementById('mealchip');
      if (chip) {
        chip.style.background = snap.css;
        chip.classList.add('show');
        setTimeout(function () { chip.classList.remove('show'); }, 2500);
      }
      G.say('photo');
      PM.saveNow(pet);
    });
  };

  G.play = function () {
    ensureAwake();
    var hasTilt = PM.hw.has.accel ||
      (window.creationSensors && window.creationSensors.accelerometer);
    if (hasTilt) {
      PM.ui.tiltGame(pet, function (score) {
        var mood = PM.act.play(pet, Math.min(20, score * 2));
        PM.ui.render(pet);
        PM.ui.toast('score ' + score + '! fun +' + Math.min(20, score * 2));
        G.say(mood);
        PM.saveNow(pet);
      });
    } else {
      /* fallback: tap frenzy */
      var taps = 0;
      PM.ui.overlay('<div class="frenzy"><div class="pick-title">tap ' + esc(pet.name) + '!</div>' +
        '<img id="frenzypet" src="' + PM.stageSprite(pet) + '"><div class="tilt-score"><span id="fcount">10</span>s</div></div>', 'frenzy-ov');
      var img = document.getElementById('frenzypet');
      img.addEventListener('click', function () {
        taps++;
        PM.ui.petMood('dance', 300);
      });
      var left = 10;
      var iv = setInterval(function () {
        left--;
        var fc = document.getElementById('fcount');
        if (fc) fc.textContent = left;
        if (left <= 0) {
          clearInterval(iv);
          PM.ui.hideOverlay();
          var mood = PM.act.play(pet, Math.min(20, taps * 2));
          PM.ui.render(pet);
          PM.ui.toast(taps + ' taps! fun +' + Math.min(20, taps * 2));
          G.say(mood);
          PM.saveNow(pet);
        }
      }, 1000);
    }
    function esc(s) { return String(s).replace(/</g, '&lt;'); }
  };

  G.sleep = function (force) {
    var to = typeof force === 'boolean' ? force : !pet.sleeping;
    pet.sleeping = to;
    PM.ui.render(pet);
    if (to) { PM.ui.sleepPrompt(true); }
    else { PM.ui.sleepPrompt(false); PM.ui.hideOverlay(); }
    PM.saveNow(pet);
  };
  G.wake = function () { if (pet.sleeping) G.sleep(false); };

  G.clean = function () {
    ensureAwake();
    var mood = PM.act.clean(pet);
    PM.ui.render(pet);
    G.say(mood);
    if (!pet.sick) PM.ui.toast('✨ sparkling.');
    PM.saveNow(pet);
  };

  G.petpet = function () {
    var mood = PM.act.pet(pet);
    PM.ui.render(pet);
    PM.ui.hearts();
    if (pet.sulking && pet.care.pets % 5 === 0) {
      pet.stats.fun = Math.min(100, pet.stats.fun + 10);
      PM.ui.toast('coaxing works... keep going');
    }
    G.say(mood);
    PM.saveNow(pet);
  };

  G.crankCharge = function () {
    ensureAwake();
    if (pet.stats.energy >= 100) { PM.ui.toast('fully wound! ⚡'); return; }
    PM.act.crank(pet, 4);
    PM.ui.render(pet);
    PM.ui.toast('⚡ winding... +' + 4 + ' energy');
    PM.ui.petMood('dance', 600);
  };

  G.ambientCheck = function () {
    PM.hw.camera.ambient().then(function (b) {
      if (b == null) return;
      if (b < 35 && !pet.sleeping && pet.stats.energy < 50) {
        PM.ui.toast('🌙 dark in here... sleepy?');
      }
    });
  };

  G.settings = function () {
    var items = [
      { label: 'voice: ' + pet.voice, sub: 'big/chatty/off', icon: '🔊', act: 'voice' },
      { label: 'time warp: ' + (pet.turbo ? 'ON' : 'off'), sub: 'dev cheat', icon: '⏩', act: 'turbo' },
      { label: 'fresh start', sub: 'new egg (!!)', icon: '🥚', act: 'reset' },
      { label: 'quit', sub: 'close creation', icon: '🚪', act: 'quit' }
    ];
    PM.ui.menu('settings', items, function (it) {
      if (it.act === 'voice') {
        pet.voice = pet.voice === 'big' ? 'chatty' : (pet.voice === 'chatty' ? 'off' : 'big');
        PM.ui.toast('voice: ' + pet.voice);
      } else if (it.act === 'turbo') {
        pet.turbo = !pet.turbo;
        PM.ui.toast('time warp ' + (pet.turbo ? 'ON' : 'off'));
      } else if (it.act === 'reset') {
        PM.wipe(); pet = null;
        location.reload();
      } else if (it.act === 'quit') {
        PM.saveNow(pet);
        PM.hw.close();
      }
      PM.saveNow(pet);
    });
  };

  /* ---------- hardware wiring ---------- */
  var lastPetTap = 0;
  G.wire = function () {
    /* nav buttons */
    document.getElementById('btn-feed').addEventListener('click', function () { if (pet && pet.stage !== 'egg') G.feed(); });
    document.getElementById('btn-play').addEventListener('click', function () { if (pet && pet.stage !== 'egg') G.play(); });
    document.getElementById('btn-sleep').addEventListener('click', function () { if (pet && pet.stage !== 'egg') G.sleep(); });
    document.getElementById('btn-clean').addEventListener('click', function () { if (pet && pet.stage !== 'egg') G.clean(); });
    document.getElementById('btn-menu').addEventListener('click', function () { if (pet && pet.stage !== 'egg') G.settings(); });

    /* pet the pet by tapping it */
    document.getElementById('pet').addEventListener('click', function () {
      if (!pet || pet.stage === 'egg' || PM.ui.isOverlay()) return;
      if (pet.sleeping) { G.wake(); return; }
      G.petpet();
    });
    /* tap poop to clean it */
    document.getElementById('poop').addEventListener('click', function () { G.clean(); });

    /* scroll: menu nav / name entry / petting */
    PM.hw.on('scrollUp', function () { G.onScroll(-1); });
    PM.hw.on('scrollDown', function () { G.onScroll(1); });
    PM.hw.on('crank', function () {
      if (pet && pet.stage !== 'egg' && !PM.ui.isOverlay()) G.crankCharge();
    });

    /* side button */
    PM.hw.on('sideClick', function () {
      if (!pet) return;
      if (PM.ui._nameNext) { PM.ui._nameNext(); PM.ui._nameNext = null; return; }
      if (PM.ui.menuChoose()) return;
      if (pet.stage === 'egg') return;
      if (pet.sleeping) { G.wake(); return; }
      if (PM.ui.isOverlay()) return;
      /* quick status peek */
      var t = pet.stats;
      PM.ui.toast(pet.name + ' 🍖' + Math.round(t.hunger) + ' 🎮' + Math.round(t.fun) +
        ' ⚡' + Math.round(t.energy) + ' 🧼' + Math.round(t.clean));
    });
    PM.hw.on('longPressStart', function () {
      if (pet && pet.stage !== 'egg' && !PM.ui.isOverlay()) G.settings();
    });

    /* accelerometer */
    PM.hw.on('shake', function () {
      if (!pet || pet.stage === 'egg') return;
      if (pet.sleeping) { G.wake(); G.say('wake'); }
      else {
        pet.stats.fun = Math.min(100, pet.stats.fun + 2);
        PM.ui.petMood('startle', 900);
        G.say('startle');
        PM.ui.render(pet);
      }
    });
    PM.hw.on('rock', function () {
      if (!pet || pet.stage === 'egg' || pet.sleeping) return;
      if (pet.stats.energy < 65) {
        G.sleep(true);
        PM.ui.toast('🌙 rocked to sleep...');
      }
    });

    /* mic */
    PM.hw.on('dance', function () {
      if (!pet || pet.stage === 'egg' || pet.sleeping) return;
      PM.act.dance(pet);
      PM.ui.petMood('dance', 2500);
      PM.ui.render(pet);
      G.say('dance');
    });
    PM.hw.on('startle', function () {
      if (!pet || pet.stage === 'egg' || pet.sleeping) return;
      PM.act.startle(pet);
      PM.ui.petMood('startle', 1200);
      PM.ui.render(pet);
      G.say('startle');
    });
    PM.hw.on('calm', function () {
      if (!pet || pet.stage === 'egg') return;
      if (!pet.sleeping && pet.stats.energy < 30) G.say('sleepy');
    });
  };

  G.onScroll = function (dir) {
    if (!pet) return;
    /* any scroll wakes a sleeping pet */
    if (pet.sleeping && pet.stage !== 'egg') { G.wake(); return; }
    /* name entry: change letter */
    if (PM.ui._nameBump) { PM.ui._nameBump(dir); return; }
    /* menu: move focus */
    if (PM.ui.menuMove(dir)) return;
    if (pet.stage === 'egg' || PM.ui.isOverlay()) return;
    /* slow scroll on main screen = petting (crank handled separately) */
    var now = Date.now();
    if (!PM.hw.crank.active && now - lastPetTap > 1500) {
      lastPetTap = now;
      G.petpet();
    }
  };

  document.addEventListener('DOMContentLoaded', G.boot);
})();
