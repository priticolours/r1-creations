/* pocket menace — pet state, persistence, time simulation.
   stats 0-100. neglect has consequences. death is not on the menu. */
window.PM = window.PM || {};

(function () {
  var SAVE_KEY = 'pm_save_v1';

  function freshStats() {
    return { hunger: 70, fun: 70, energy: 80, clean: 80 };
  }

  PM.newPet = function (species, name) {
    var now = Date.now();
    return {
      v: 1,
      species: species,
      name: (name || PM.SPECIES[species].defaultName).toUpperCase().slice(0, 8),
      stage: 'egg',            // egg -> baby -> teen -> adult
      form: 'idol',            // idol | grunge (adult look / overlay for younger)
      stats: freshStats(),
      eggTaps: 0,
      bornAt: now,
      awakeMin: 0,             // accumulated awake minutes (drives growth)
      lastSeen: now,
      sleeping: false,
      poop: false,
      poopAt: now + 1000 * 60 * 50,
      sick: false,
      sickAt: 0,
      sulking: false,
      grungeMin: 0,            // minutes spent neglected while adult idol
      rehabMin: 0,             // minutes of good care while grunge
      care: { feeds: 0, plays: 0, pets: 0, cleans: 0, cranks: 0, photos: 0 },
      turbo: false,            // dev time-warp
      voice: 'big',            // 'big' = speaks on big moments, 'chatty' = talks a lot
      seenHatch: false,
      journaled: {}
    };
  };

  PM.avgStats = function (s) {
    var t = s.stats;
    return Math.round((t.hunger + t.fun + t.energy + t.clean) / 4);
  };

  /* care score 0-100: stat health + interaction history */
  PM.careScore = function (s) {
    var c = s.care;
    var interactions = Math.min(40, (c.feeds + c.plays + c.pets + c.cleans) * 2);
    return Math.round(PM.avgStats(s) * 0.6 + interactions);
  };

  PM.stageSprite = function (s) {
    if (s.stage === 'egg') return 'sprites/egg.png';
    var sp = PM.SPECIES[s.species];
    if (s.stage === 'adult') return sp.sprite(s.form);
    return sp.sprite(s.stage); // baby | teen
  };

  PM.isNeglected = function (s) {
    return PM.avgStats(s) < 35;
  };

  function clampStats(s) {
    var t = s.stats;
    for (var k in t) t[k] = Math.max(0, Math.min(100, Math.round(t[k])));
  }

  /* simulate `mins` minutes. returns event list for UI/LLM reactions. */
  PM.tick = function (s, mins) {
    var events = [];
    var t = s.stats;
    var rate = s.turbo ? 60 : 1;
    mins = mins * rate;
    if (mins <= 0) return events;

    var wasSleeping = s.sleeping;

    if (s.stage === 'egg') {
      s.lastSeen = Date.now();
      return events; // eggs just vibe
    }

    if (s.sleeping) {
      t.energy = Math.min(100, t.energy + 6 * mins);
      t.hunger = Math.max(0, t.hunger - 0.4 * mins);
      t.fun = Math.max(0, t.fun - 0.3 * mins);
      t.clean = Math.max(0, t.clean - 0.2 * mins);
      if (t.energy >= 100) { s.sleeping = false; events.push('wake'); }
    } else {
      s.awakeMin += mins;
      t.hunger = Math.max(0, t.hunger - 1.1 * mins);
      t.fun = Math.max(0, t.fun - 0.9 * mins);
      t.energy = Math.max(0, t.energy - 0.7 * mins);
      t.clean = Math.max(0, t.clean - 0.25 * mins);
      if (t.energy <= 0) { s.sleeping = true; events.push('crash'); }
    }

    /* poop happens */
    if (!s.poop && Date.now() > s.poopAt && !s.sleeping) {
      s.poop = true;
      t.clean = Math.max(0, t.clean - 25);
      events.push('poop');
    }

    /* sickness from filth */
    if (!s.sick && t.clean < 20) {
      if (!s.sickAt) s.sickAt = Date.now();
      if (Date.now() - s.sickAt > 1000 * 60 * 20) { s.sick = true; events.push('sick'); }
    } else if (t.clean >= 20) {
      s.sickAt = 0;
    }

    /* sulking from boredom */
    if (!s.sulking && t.fun < 15 && !s.sleeping) {
      s.sulking = true; events.push('sulk');
    } else if (s.sulking && t.fun >= 40) {
      s.sulking = false; events.push('unsulk');
    }

    /* ---- growth & evolution ---- */
    if (s.stage === 'baby' && s.awakeMin > 40) {
      s.stage = 'teen'; events.push('evolve');
    } else if (s.stage === 'teen' && s.awakeMin > 140) {
      s.stage = 'adult';
      s.form = PM.careScore(s) >= 55 ? 'idol' : 'grunge';
      events.push('evolve');
    } else if (s.stage === 'adult') {
      /* fall from grace: sustained neglect turns an idol grunge */
      if (s.form === 'idol' && PM.isNeglected(s)) {
        s.grungeMin += mins;
        if (s.grungeMin > 45) { s.form = 'grunge'; s.grungeMin = 0; events.push('evolve'); }
      } else { s.grungeMin = 0; }
      /* redemption arc: sustained good care rehabilitates a grunge */
      if (s.form === 'grunge' && PM.avgStats(s) > 65) {
        s.rehabMin += mins;
        if (s.rehabMin > 20) { s.form = 'idol'; s.rehabMin = 0; events.push('evolve'); }
      } else { s.rehabMin = 0; }
    }

    /* critical warnings */
    if (t.hunger <= 8) events.push('starving');
    else if (t.hunger <= 25) events.push('hungry');
    if (t.energy <= 12 && !wasSleeping) events.push('sleepy');

    clampStats(s);
    s.lastSeen = Date.now();
    return events;
  };

  /* apply one-off action effects. returns reaction hint. */
  PM.act = {
    feed: function (s, food) {
      var t = s.stats, sp = PM.SPECIES[s.species];
      var mult = 1;
      if (sp.likes.indexOf(food.id) >= 0) mult = 1.25;
      if (sp.dislikes.indexOf(food.id) >= 0) mult = 0.6;
      t.hunger = Math.min(100, t.hunger + food.hunger * mult);
      t.fun = Math.min(100, t.fun + food.fun);
      t.energy = Math.min(100, t.energy + food.energy);
      s.care.feeds++;
      clampStats(s);
      return mult > 1 ? 'happy' : (mult < 1 ? 'sad' : 'idle');
    },
    photoMeal: function (s, colorName) {
      var t = s.stats;
      t.hunger = Math.min(100, t.hunger + 18);
      t.fun = Math.min(100, t.fun + 10);
      s.care.feeds++; s.care.photos++;
      clampStats(s);
      return 'photo';
    },
    play: function (s, score) {
      var t = s.stats;
      t.fun = Math.min(100, t.fun + 10 + score);
      t.energy = Math.max(0, t.energy - 8);
      t.hunger = Math.max(0, t.hunger - 5);
      s.care.plays++;
      if (s.sulking && t.fun >= 40) s.sulking = false;
      clampStats(s);
      return 'happy';
    },
    pet: function (s) {
      var t = s.stats;
      t.fun = Math.min(100, t.fun + 4);
      s.care.pets++;
      if (s.sulking && s.care.pets % 5 === 0) { /* coaxing */ }
      clampStats(s);
      return 'petted';
    },
    clean: function (s) {
      var t = s.stats;
      if (s.poop) { s.poop = false; s.poopAt = Date.now() + 1000 * 60 * (45 + Math.random() * 45); }
      t.clean = Math.min(100, t.clean + 35);
      s.care.cleans++;
      if (s.sick && t.clean > 60 && s.care.cleans % 3 === 0) { s.sick = false; }
      clampStats(s);
      return 'clean';
    },
    crank: function (s, amount) {
      var t = s.stats;
      t.energy = Math.min(100, t.energy + amount);
      s.care.cranks++;
      clampStats(s);
    },
    dance: function (s) {
      var t = s.stats;
      t.fun = Math.min(100, t.fun + 10);
      t.energy = Math.max(0, t.energy - 4);
      clampStats(s);
    },
    startle: function (s) {
      var t = s.stats;
      t.fun = Math.max(0, t.fun - 2);
      t.energy = Math.max(0, t.energy - 2);
      clampStats(s);
    }
  };

  /* ---------- persistence ----------
     belt and suspenders: creationStorage is async and may not flush before
     the webview dies, so every save also goes to localStorage (sync).
     loads prefer creationStorage but fall back to localStorage. */
  PM.saveNow = function (s) {
    if (!s) return;
    var raw;
    try { raw = btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
    catch (e) { return; }
    try { localStorage.setItem(SAVE_KEY, raw); } catch (e) {}
    try {
      if (window.creationStorage && window.creationStorage.plain) {
        var r = window.creationStorage.plain.setItem(SAVE_KEY, raw);
        if (r && typeof r.catch === 'function') r.catch(function () {});
      }
    } catch (e) {}
  };

  PM.loadSaved = function () {
    function parse(raw) {
      if (!raw) return null;
      try { return JSON.parse(decodeURIComponent(escape(atob(raw)))); }
      catch (e) { return null; }
    }
    function fromLocal() {
      try { return parse(localStorage.getItem(SAVE_KEY)); }
      catch (e) { return null; }
    }
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }
      /* never hang boot on a stalled bridge */
      setTimeout(function () { done(fromLocal()); }, 2500);
      try {
        if (window.creationStorage && window.creationStorage.plain) {
          var p = window.creationStorage.plain.getItem(SAVE_KEY);
          if (p && typeof p.then === 'function') {
            p.then(function (raw) { done(parse(raw) || fromLocal()); })
             .catch(function () { done(fromLocal()); });
          } else { done(parse(p) || fromLocal()); }
        } else done(fromLocal());
      } catch (e) { done(fromLocal()); }
    });
  };

  PM.wipe = function () {
    try {
      if (window.creationStorage && window.creationStorage.plain) {
        window.creationStorage.plain.removeItem(SAVE_KEY);
      }
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  };
})();
