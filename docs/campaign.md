# Campaign and animated obstacles

The existing C/Sokol/WebAssembly game now loads 100 campaign levels from
`data/campaign/`. The original twenty maps and original models remain unchanged.
The main menu and Pituca/Pompom loading sprites remain unchanged. The trail is
inside the solo course chooser, with ten localized world bands. Saved records
use `pitpom100_best_` keys; previous `stroke_count_level_` records are retained.

| Courses | World | Mechanics introduced |
| --- | --- | --- |
| 1–10 | Bosque da Tranquilidade | Basic aiming, different bends and bank shots |
| 11–20 | Lagoa Zen | Water around causeways, Romeu |
| 21–30 | Loop da Meditação | Circular bends, physical vertical loops, tunnels |
| 31–40 | Salto da Esperança | Elevated ramps and crests, Luna |
| 41–50 | Jardim dos Ventos | Fans, gusts and timed gates |
| 51–60 | Vale das Ilusões | Paired portals, alternative paths, Frida |
| 61–70 | Vulcão da Paciência | Lava recovery hazards and narrower tracks |
| 71–80 | Labirinto das Estrelas | Staggered baffles, moving ferries, gates and portals |
| 81–90 | Caos da Harmonia | Combined water, loop, wind and animal effects |
| 91–100 | Caminho da Iluminação | Final combinations and tightest approaches |

Ten route grammars, circular corner fillets, different widths/elevations and
mechanical combinations produce 100 distinct collision meshes. The loop's
connected green offers a slower route. Portals offer optional shortcuts. A missed
shot uses the established recovery rules. Course-specific camera zones use the
original camera implementation and face down the track. Campaign landscape
mountains surround the course centre with at least ten metres of clearance from
the main fairway bounds, leaving room for side routes and the playable camera.

`python build/generate-campaign.py` regenerates levels, the detailed manifest and
the browser's small metadata table. `--check` checks reproducibility and unique
geometry hashes. Generated files are committed, so players require no generator.

## Animal interactions

`src/golf/wildlife.c` is shared by the offline game and native authoritative
worker. Clients render server positions/actions and never select destinations.
Patrols use reachable floor samples and exclude walls, water, holes, spawn and
the swept areas of moving obstacles. Short eased walks include pauses.

* **Romeu:** black curly poodle with floppy ears, a graying muzzle and a gray
  crochet vest with navy blue/red rows. A playful
  raised-leg animation applies 3.8 seconds of extra drag and a temporary tint.
  The player's stored color and avatar never change.
* **Luna:** small, slightly elongated dark chocolate dog with partly upright
  rounded ears, a gray muzzle and a pale chest patch. Carries the ball for 1.15 seconds
  and releases it at the level's original spawn with the stroke count retained.
* **Frida:** white cat with a dark tabby cap/ears, a central white blaze and
  relaxed green eyes. A brief paw animation hides
  the ball for 0.85 seconds, then releases it on reachable clear floor. Selection
  uses the authoritative seed, player identity and contact count.

Contacts have individual six-second cooldowns and contact-exit tracking. Captures
block shots and ball impacts; release gives 2.5 seconds of animal protection and
a short impact grace period. Each ball keeps its own effect state. New sounds
use the existing effects bus and respect volume/mute preferences. The minimap
marks these animals R/L/F and localizes effect feedback in EN/PT-BR/ES.

The three new 3D animals follow the user's photographs in order: Romeu, Luna,
Frida. Romeu's gray, blue and red crochet vest also follows the user's explicit
color clarification. Pituca remains black/white, Pompom orange/white.

## Verification

* Native CTest runs the original 41 checks plus one test per campaign course.
  Each campaign test completes the hole using real C physics and bot-planned
  shots (up to 90 strokes), with animal effects disabled for that geometry
  witness. Separate contact fixtures validate every requested animal, 50
  simultaneous individual effects, cooldowns, captures, safe destinations,
  deterministic Frida selection and 20 seconds of safe patrols. Portal and wind
  fixtures exercise their real shared mechanics. Loop tests use actual shots
  that climb above the ring centre and complete the return to its exit.
* `server/test/campaign.test.ts` checks all configured routes and two independent
  C workers with the same seed and 50 players in Classic and Impact.
* `node server/test/campaign-browser.mjs` (run from `server` as
  `node test/campaign-browser.mjs`) renders all 100 maps in desktop/mobile Chrome
  contexts, checks actor/scenery buffers, translations and matching trusted
  animal snapshots, including all three animal actions and both carried balls
  at once, and saves world screenshots under ignored `out/`.
* `node test/wildlife-render.mjs` additionally renders the final course with
  fifty Impact players and all three animal actions, checking the desktop and
  narrow-screen actor budget with both carried balls present.
* Existing browser checks cover the solo trail, loading art, host/guest flow,
  audio preferences, touch controls, five aiming arrows and reconnection.

CI compiles and tests the Linux Docker image before staging deployment. Mobile
checks emulate touch in Chromium; physical Android/iOS testing remains manual.
