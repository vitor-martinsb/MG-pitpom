# Visual refresh and structural campaign diversity

The existing C/Sokol/WebAssembly renderer and authoritative C worker are retained.
The original twenty maps, ball physics, scoring, bots, languages, music, loading,
cosmetics and room flow remain in place. This request replaces the 100 generated
campaign layouts, rather than changing only their colors or obstacle positions.

## Campaign design

`build/campaign-layouts.py` defines twenty structural families with authored,
different sequences per world: organic groves, serpents, horseshoes, switchbacks,
crescents, spirals, terraces, forks, archipelagos, precision passages, canyons,
courtyards, bridges, meanders, citadels, hairpins, deltas, craters and constellations.
Each world has at least eight families among its ten courses. Dimensions,
elevation profiles, widths and obstacle combinations vary. Multiple courses have
shorter exposed alternate routes. Four courses require a real airborne gap;
island courses alternate broad landings with narrow connecting sections.

The generator rasterizes the actual playable floor polygons, including branches,
variable widths and gaps, to a 28 by 28 grid. It compares every new layout against
every earlier one, using maximum intersection over union across all rotations and
reflections. Similarity of 0.86 or higher rejects and regenerates a candidate.
Color, textures and decoration do not affect this comparison. The threshold,
accepted attempts and measured similarities are recorded in the manifest.
`python build/generate-campaign.py --check` reproduces geometry and validation.

Loops have clear approach/exit greens outside the main lane, with a connected
approach. Spiral shortcuts do not cross the starting lane at a different height:
the current navigation grid represents one floor per X/Z cell. Portals choose a
nearby safe floor when their authored point falls in a gap or swept obstacle
area. Animals keep clearance from portal endpoints. Lava uses the existing
water-recovery mechanism, while keeping its lava appearance, so a miss cannot
leave a stationary ball on an unreachable basin floor.

## Scenery and rock

`src/golf/garden.c` draws continuous non-colliding terrain beneath and around the
campaign, with forest banks, vegetation in clear gaps, relief and world-specific
water, volcanic and night palettes. Placement checks the playable floor before
adding vegetation. The scenery remains a cached mesh; it adds no physics work
or per-tree draw calls. The existing world and actor vertex budgets are retained.

Bank stones, timed stones and maze stones use a closed, asymmetric low-poly hull
in natural gray. The same authored faces drive rendering and collision; there
is no separate cube collider. Platforms and tunnels retain their original roles.

## Romeu and puddles

Romeu follows the supplied poodle reference: black rounded fur, floppy fluffy
ears, a gentle elongated muzzle, friendly eyes, defined paws and a pompom tail.
His gray vest has white, red and navy accents on a fitted surface with leg
openings. Its coloring belongs to the garment surface, replacing detached stitch
objects. Pompom and Romeu share the quadruped leg routine. Romeu's step phase is
driven by travelled distance, including return walks, with a planted stance,
raised return and smooth fade to rest. The authoritative phase and speed are
replicated, so different clients render the same walking state.

The worker records accepted physical shots in global order. A puddle remembers
the current sequence at creation and counts completion of the next three
accepted strokes. The triggering stroke is excluded. Concurrent strokes may
finish in a different order; removal waits for those three to finish. Duplicate
registration/completion is idempotent. Each puddle has its own counter. There is
no lifetime timer. The visible puddle disappears on the third global completion.
Slowness now belongs to each affected ball and lasts three of that player's next
completed valid strokes, even outside the puddle; see [current rules](romeu-slowness.md).
All puddles and per-ball effects clear on loading the next map.

Creation, counter and removal travel in authoritative snapshots, including
reconnect. The same state and rules run offline. Candidate bot simulations copy
this state and cannot create or remove live puddles.

## Minimap and fonts

The minimap draws only course geometry, obstacles, a geometric hole symbol and
simple balls. It never calls text drawing routines and has no animal drawing.
Its collapse control is an SVG icon with a translated accessible label. World
and effect notices sit visibly outside the panel. Names above balls remain in
the main scene.

Poppins Regular 400, Medium 500, SemiBold 600 and Bold 700 are served locally for
HTML and imported into Latin-1 font atlases for C-rendered menus and labels.
Font files and the SIL Open Font License are in `data/font/poppins`. They come
from [Google Fonts' Poppins distribution](https://github.com/google/fonts/tree/main/ofl/poppins).
The UI shares one family and retains its existing fitting/responsive behavior.

## Validation

`golf_puddle_test` checks three completed global strokes, duplicate events,
out-of-order completion, independent puddles, absence of clock expiry, map
cleanup, distance-driven gait, and actual rock collisions at low/medium/maximum
power. The 100 campaign witnesses use real Hard bot shots with the production
attempt-memory path and validate animal placement, effects, safe patrols,
portals and physical loops. Their geometry-only witness disables NPCs while
the separate effect checks exercise those interactions.

`server/test/visual-refresh.mjs` verifies four loaded Poppins weights, the clean
live minimap, notices outside its bounds, forest rendering, and replicated
puddle states 3/2/1/removed on desktop and mobile. It saves screenshots in ignored
`out/visual-refresh`. Existing 100-map browser, 50-player wildlife, touch,
language, solo, audio, bot, protocol and scoring suites remain required.
Mobile automation uses Chromium emulation; physical Android/iOS device review
remains separate. Render publication still follows dev validation and a
fast-forward promotion to staging.
