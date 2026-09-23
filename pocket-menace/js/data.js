/* pocket menace — static data: species, foods, dialogue pools.
   pet voice: lowercase, dry, punk. no marketing polish. */
window.PM = window.PM || {};

PM.SPECIES_ORDER = ['bunny', 'cat', 'mouse'];

PM.SPECIES = {
  bunny: {
    key: 'bunny',
    label: 'imp-bunny',
    defaultName: 'RIOT',
    blurb: 'feral. hood up. will bite.',
    sprite: function (stage) { return 'sprites/bunny-' + stage + '.png'; },
    likes: ['pizza', 'donut'],
    dislikes: ['slush']
  },
  cat: {
    key: 'cat',
    label: 'alley cat',
    defaultName: 'HEX',
    blurb: 'judges you first. loves you after.',
    sprite: function (stage) { return 'sprites/cat-' + stage + '.png'; },
    likes: ['slush', 'pizza'],
    dislikes: ['donut']
  },
  mouse: {
    key: 'mouse',
    label: 'glitch mouse',
    defaultName: 'PIXEL',
    blurb: 'overclocked. snacks over sleep.',
    sprite: function (stage) { return 'sprites/mouse-' + stage + '.png'; },
    likes: ['donut', 'slush'],
    dislikes: ['pizza']
  }
};

PM.FOODS = [
  { id: 'pizza', name: 'cold pizza', icon: '🍕', hunger: 30, fun: 6, energy: 2 },
  { id: 'slush', name: 'pink slush', icon: '🧃', hunger: 12, fun: 8, energy: 12 },
  { id: 'donut', name: 'chain donut', icon: '🍩', hunger: 20, fun: 12, energy: 4 }
];

PM.MEAL_NAMES = [
  'mystery mush', 'floor surprise', 'questionable bytes', 'dumpster deluxe',
  'static stew', 'neon nachos', 'glitch grub', 'midnight leftovers'
];

/* fallback lines when the LLM is unreachable. same voice. */
PM.LINES = {
  idle: [
    '...what.',
    'u staring at something?',
    'this hood doesn\'t fluff itself.',
    'i\'m bored. fix it.',
    'sup.'
  ],
  happy: [
    'ok that was decent.',
    'heh. not bad.',
    'again. again.',
    'u get me. scary.'
  ],
  hungry: [
    'feed me. i\'m fading.',
    'my stomach just growled in cursive.',
    'food. now. please-ish.'
  ],
  starving: [
    'i\'m seeing static. FEED ME.',
    'this is neglect and i\'m telling everyone.',
    'i would eat the wallpaper.'
  ],
  sad: [
    'leave me alone. ...actually don\'t.',
    'nobody gets me. except maybe u.',
    'i\'m fine. (i\'m not fine.)'
  ],
  sleepy: [
    'eyes heavy... hood heavier...',
    'five more minutes. or fifty.',
    'zzz... no i\'m awake. zzz...'
  ],
  sick: [
    'i feel like warm garbage.',
    'everything hurts. hold me. no. yes.',
    'don\'t look at me like that.'
  ],
  grunge: [
    'yeah. i look rough. what about it.',
    'the alley provides.',
    'beauty is a construct. pass the pizza.'
  ],
  evolve: [
    'something\'s happening. it itches.',
    'new form just dropped.',
    'i feel... powerful. and itchy.'
  ],
  hatch: [
    '...hello? oh. OH. hi!!',
    'finally. it was cramped in there.',
    'u. u are my person now. deal.'
  ],
  photo: [
    'u want me to eat THAT?',
    '...actually smells ok.',
    'fine. but i\'m judging the plating.'
  ],
  dance: [
    'TURN IT UP.',
    'this is my song!! (all songs are my song)',
    'witness me.'
  ],
  startle: [
    'WHAT WAS THAT.',
    'i\'m fine. i meant to do that.',
    'my heart is doing drums now.'
  ],
  petted: [
    '...don\'t stop.',
    'ok. u can stay.',
    'purring is a construct. (purrs)'
  ],
  clean: [
    'finally. i was marinating.',
    'u missed a spot. kidding. thanks.',
    'fresh. feral. free.'
  ],
  sulk: [
    '...',
    '(audible sigh)',
    'talk to the hood.'
  ],
  wake: [
    'i\'m up. i\'m up. what\'s happening.',
    'five more-- no wait, i\'m awake.',
    'did u miss me. be honest.'
  ]
};

PM.pick = function (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
};

/* hue (0-360) -> meal vibe name */
PM.mealVibe = function (h) {
  if (h < 15 || h >= 345) return 'red alert';
  if (h < 45) return 'orange static';
  if (h < 75) return 'toxic glow';
  if (h < 160) return 'swamp slime';
  if (h < 200) return 'glitch mint';
  if (h < 260) return 'neon blue';
  if (h < 300) return 'void purple';
  return 'bubblegum chaos';
};

PM.cssColor = function (r, g, b) {
  return 'rgb(' + r + ',' + g + ',' + b + ')';
};
