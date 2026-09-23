# pocket menace — game design doc

a tamagotchi-style digital pet for the rabbit r1. punk / y2k / cyberpunk
energy, animal-crossing warmth. original characters, no licensed IP.

## the pets

three species, pick order: bunny → cat → mouse.

| species | concept | stages |
|---|---|---|
| imp-bunny | white punk imp-bunny girl, jester hood, pink skull emblem, star shades | baby / teen / adult idol / grunge |
| alley cat | scrappy alley cat, pink mini-mohawk, safety-pin earring, star shades, spiked collar | baby / teen / adult idol / grunge |
| glitch mouse | street-tech mouse, pink visor + star clips, circuit-ear details, cargo shorts, platform boots | baby / teen / adult idol / grunge |

each pet gets an arcade-style name entry: scroll wheel cycles letters,
tap to confirm.

## core stats (0–100)

- **hunger** — decays over time. feed snacks (+small) or full meals.
- **fun** — decays over time. play mini-games, pet, dance party.
- **energy** — decays over time; sleeping restores. crank-charge via
  fast scroll as a fallback.
- **clean** — decays; poop events drop it hard. clean it.

stats decay in real time while the app runs **and** while away — away
time is reconciled on load, so neglect while you're gone still counts.

## life stages

1. **egg** — hatches after 25 taps or ~2 minutes.
2. **baby** — chibi sprite, needy, faster decay.
3. **teen** — lanky rebellious sprite, mini-games unlock fully.
4. **adult** — final form depends on care quality:
   - **idol** — consistently good care. sparkly, confident.
   - **grunge** — sustained neglect. scuffed, droopy, bandaged.

## stakes: consequences, no death

neglect is never fatal. the arc, roughly two hours of sustained neglect
to hit grunge:

- stats hit 0 → **sick** (needs medicine/care, not death)
- ignored while sick → **sulking** (refuses play, mood penalty)
- energy at 0 → **passes out** (forced sleep)
- low clean → **dirt + poop events** (must clean)
- sustained neglect → **grunge evolution** (visual + mood shift)

**rehabilitation:** a grunge pet kept at average stats above 65 for more
than 20 minutes evolves back toward idol. the arc is always reversible.

## care actions

| action | input | effect |
|---|---|---|
| feed snack | menu / tap | +hunger small |
| feed meal | menu | +hunger large, mood |
| photo feeding | camera | snap real food → pet eats a meal rendered in the photo's dominant colors; LLM reacts to it |
| pet | tap / slow scroll | +fun, +mood |
| clean | menu | +clean, clears poop |
| sleep | menu / rock (accelerometer) | restores energy over time |
| wake | shake (accelerometer) / tap | wakes sleeping pet |
| tilt treat game | accelerometer | roll a treat into the pet's mouth, +fun +hunger |
| tap frenzy | touchscreen | fallback fun game |
| crank charge | fast scroll | +energy in a pinch |
| dance party | mic loudness | loud music → pet dances, +fun |
| calm | mic quiet | long quiet → calm mood |

actions wake a sleeping pet first, then proceed.

## hardware map

| input | SDK surface | use |
|---|---|---|
| scroll wheel | scrollUp / scrollDown | menu nav, arcade naming, slow-scroll petting, fast-scroll crank |
| side button | sideClick / longPressStart / longPressEnd | tap = status peek / select, long-press = settings |
| accelerometer | creationSensors.accelerometer (x/y/z, −1..1, up to 60Hz) | shake-to-wake, rock-to-sleep, tilt mini-game, tantrum shake |
| camera | getUserMedia frame capture | photo feeding (dominant-color meals), ambient-light sleep hints |
| mic | loudness sampling | dance party / startled / calm — loudness only, no speech |
| touchscreen | TouchEventHandler | tap to pet, drag food, egg taps |
| speaker | wantsR1Response | pet speaks on big moments via r1 LLM voice |
| LLM | useLLM / PluginMessageHandler → window.onPluginMessage | personality lines, photo-meal reactions, idle chatter |
| storage | creationStorage (base64, per-plugin) | full pet state persists across sessions |
| journal | wantsJournalEntry | hatch + evolution logged to r1 journal |

voice chattiness: big moments only by default; big → chatty → off in
settings. (verify: wantsJournalEntry / speaker behavior with
`useLLM:false` needs a physical r1 test — SDK examples usually attach
these flags to `useLLM:true`.)

## persistence schema (creationStorage)

```
{
  species, name,
  stage: egg|baby|teen|adult,
  form: normal|idol|grunge,
  stats: { hunger, fun, energy, clean },
  mood, sick, sulking, poop,
  bornAt, lastTick, lastSeen,
  careHistory: [...],       // drives idol/grunge + rehab
  voice: big|chatty|off,
  journaled: { hatch, evolutions }
}
```

## sprites (13)

`egg.png`, plus per species: `baby`, `teen`, `idol`, `grunge`.
all PNG with transparent backgrounds (white keyed out via
`scripts/make_transparent.py`, border-connected flood fill).
downscaled for the r1's weak hardware — CSS transform/opacity only,
minimal DOM, no particle systems.

## tuning

- hatch: 25 taps or ~2 min
- idol/grunge evaluation: rolling care quality
- rehab: avg stats > 65 for > 20 min
- full neglect → grunge: ~2 hours
- away-time decay reconciled on load

## test status (2026-09-23)

- 22/22 node logic tests pass (evolution, idol/grunge, rehab, feeding,
  poop/clean, sulk, sleep/wake, sickness, save/load, meal vibes,
  sprite paths)
- all JS passes `node --check`; DOM ids cross-checked; local HTTP 200
- 240×282 layout not yet visually verified (headless screenshots hung)
- camera / mic / accelerometer thresholds / scroll / storage / LLM
  voice / journal need physical r1 testing
