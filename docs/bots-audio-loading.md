# Bots, DNF, world music and loading

This extends the existing authoritative C worker and WebAssembly client. It
does not replace physics, courses, controls, cosmetics, chat or offline play.

## Scoring and room controls

DNF is always valid strokes plus 12, once per course. For example, three strokes
become 15 DNF. The DNF marker remains visible; totals add these course scores.
The legacy configurable DNF penalty no longer changes this rule.

Only the human host can change bots in the lobby. The count ranges from zero to
50 minus the human count. Applying a count also applies the selected general
difficulty; each bot still has individual name, color and difficulty controls.
Names cycle through 15 AI-inspired identities, then numbered suffixes. Matching
is case insensitive. A human joining with a bot's name retains that name and
the bot is renamed. These names do not call external AI services.

Easy, Medium, Hard and Expert differ in candidate count (24/48/96/144), precision,
simulation horizon and lookahead. Hard can stop early on clear progress. Hard
and Expert evaluate a bounded second shot. Navigation adds directed ramp/drop
and portal links to the planner only; animal patrol and respawn safety remain
unchanged. Ballistic estimates suggest takeoff speeds, then copied real physics
validates candidates, moving collisions, wind, captures and safe landings.
Actual unsuccessful shots are remembered in an eight-attempt buffer per ball,
reducing repeated bad choices and broadening exploration. Planning never moves
the live ball, increments strokes or emits live effects.

The course timer remains the main limit; bots also have a separate 48-stroke
safety bound. A bot can still miss or DNF. The DNF addition is unrelated to that
bound. Memory resets with the course's worker.

## Automatic acceleration

The server uses 5x only when every human has finished or is marked DNF and bots
remain. An unfinished disconnected human blocks acceleration to protect
reconnection. There is no client control over simulation speed. Fixed 1/120 s
physics steps and simulation-time decision delays are retained; snapshots carry
the speed and remaining virtual time. All clients show a translated indicator.
The next course resets to 1x. Acceleration increases server work, not shot force.

## Ten original scores

`build/emscripten/lofi.js` contains original instrumental compositions and
synthesized soundscapes under the project's license, without external samples
or recordings. Each world's ten courses share its score:

| World | Identity | BPM |
|---|---|---|
| 1 | Acoustic keys, nature and birds | 60 |
| 2 | Soft synths, water and drips | 58 |
| 3 | Circular melody, ambient pads and hypnotic beat | 62 |
| 4 | Optimistic piano and light percussion | 66 |
| 5 | Flute and airy wind | 60 |
| 6 | Mysterious melody, delay and mist | 59 |
| 7 | Deeper bass and warm percussion | 64 |
| 8 | Cosmic overtones and spacious echoes | 58 |
| 9 | Electronic syncopation | 72 |
| 10 | Cinematic piano and longer harmony | 62 |

World changes crossfade over 1.8 seconds. Course changes within the same world
retain the playback cursor. The menu has its own 62 BPM interlude. WebAudio
scheduling overlaps note tails and chord cycles without file-loop cuts.
Existing volume, mute, independent effects levels, gesture unlock and browser
preference storage remain available.

## Loading

The existing PNG atlas is unchanged. Pituca is the black-and-white dog; Pompom
is the orange-and-white cat. Each uses one SVG image reference and its own
eight-frame sequence. Pituca leads their continuous orbit. Positions use elapsed
time and percentages, so resizing changes layout without resetting animation.
Sprites cannot overlap at the supported sizes. There are no dotted rings,
trails or added animals. Reduced-motion preferences keep stable poses.

## Reproducible validation

Build with `python build/multiplayer.py build`, then use the existing native and
Node suites. From `server`, with the built worker and web assets available:

```sh
npm test
node test/bot-updates-browser.mjs
node test/loading-audio.mjs
node test/campaign-browser.mjs
```

`bots-update.test.ts` checks DNF examples, totals and duplicate prevention,
host-only capacity/names/difficulty, speed gating and reset, identical C
trajectories under different batching, every difficulty on real rising and
descending gap fixtures, and attempt memory. `bot-updates-browser.mjs` plays a
real two-human/three-bot match, checks translated controls, bot identities,
reconnect, 5x and the resulting 15 DNF on desktop/mobile browsers.

`loading-audio.mjs` samples all animation frames through resizing, checks sprite
separation, renders complete musical cycles for all ten worlds, verifies unique
audible signals and continuity, and checks crossfades and persisted mute. Its
WAV previews, metrics and screenshots go to ignored `out/bots-audio-validation`.
The campaign browser suite checks that every course selects its world's music.

These automated mobile checks use Chromium emulation; physical Android/iOS and
subjective listening on different speakers still need manual review. Campaign
geometry witnesses disable NPC interactions only for their geometry check;
separate physics tests exercise those effects. Linux/container validation runs
in GitHub Actions before staging's Render deployment becomes eligible.
