# pocket menace

a tamagotchi-style digital pet for the rabbit r1. pick one of three punk
menaces (imp-bunny, alley cat, glitch mouse), hatch it, feed it, play with
it, and try not to neglect it — neglect has consequences, but nobody dies
here.

built on the [r1 creations SDK](https://github.com/rabbit-hmi-oss/creations-sdk).
240x282, lightweight by design.

## how it plays

- **adopt** — pick your species, name it arcade-style (scroll = letter)
- **hatch** — tap the egg 25x or wait 2 minutes
- **care loop** — hunger / fun / energy / clean decay in real time and while
  you're away. feed, play, clean, pet, sleep.
- **evolve** — baby → teen → adult. good care → idol form. sustained
  neglect → grunge gremlin form. grunge pets can earn their way back.
- **neglect consequences** — no death: the pet gets sick, sulks, devolves.
  rehabilitation is always possible.

## hardware map (pushing the r1)

| input | use |
|---|---|
| scroll wheel | menu nav, arcade name entry, slow-scroll = petting, fast-scroll = crank-charging energy |
| side button | tap = status peek / menu select, long-press = settings |
| accelerometer | shake = wake/rattle, rhythmic rocking = rock to sleep, tilt = treat-rolling mini-game |
| camera | photo feeding (snap real food → the pet eats a meal in those colors), ambient-light sleep hints |
| mic | loudness only — loud music = dance party, sudden bang = startled, long quiet = calm |
| speaker | the pet talks via the r1's LLM voice on big moments (hatch, evolution, starving). voice: big/chatty/off in settings |
| LLM | personality lines, photo-meal reactions |
| storage | full pet state persists per-creation; journal entries for hatch/evolution |

## run it

host this folder (e.g. github pages), open `install.html` on your phone,
scan the QR with the r1 camera.

`?demo=1` on the index URL skips straight to a test pet.

## files

- `index.html` — the creation
- `install.html` — QR install page (self-derives its URL)
- `css/style.css` — 240x282 punk y2k
- `js/data.js` — species, foods, dialogue pools
- `js/state.js` — pet state, time sim, persistence
- `js/hw.js` — hardware + LLM wiring
- `js/ui.js` — screens, menus, mini-games
- `js/game.js` — engine, boot flow, main loop
- `sprites/` — 13 hand-directed pixel-art sprites (egg + 3 species × baby/teen/idol/grunge)

## install on the r1

point your r1 camera at this:

![pocket menace install QR](pocket-menace-qr.png)
