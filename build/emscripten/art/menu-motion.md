# Desktop animation repair

The desktop diagnosis reproduced an actual stopped scene: under
`prefers-reduced-motion: reduce`, all 45 existing WAAPI animations were paused
by `visibility()`. The mill's computed transform stayed at the identity matrix
between real screenshots 2.3 seconds apart. The same desktop viewport under
`no-preference` advanced normally. This is a reproduced cause, rather than a
claim about the unknown setting on the reporting player's computer.

Reduced-motion browsers now keep gentle ambient motion at 30% speed. The menu
and tab visibility still pause everything when hidden. Normal motion retains
small amplitudes; breathing, ears and head movement are slightly more visible.
The static fallback image is hidden after the animated scene becomes ready.

The previous character rig also drew original tail pixels in the body image
as well as a moving copy. Tails are now removed from every static body/head/ear
source, and drawn exactly once behind the body. The extra gray appendage on
Frida's left was removed from her cached source. Only her right tail remains;
Pituca still has no tail layer. Heads and ears also use separate pixel regions
instead of painting moving copies over the same static face.

The slogan node is removed entirely from the HTML in every language. The
heading's top margin closes the space formerly occupied by that node.

Cloud and water animation did not exist previously. Original cloud pixels now
move across cloud-free sky plates in a shared wind direction, wrapping outside
the viewport. Small water strokes move and fade inside the existing river.
Vegetation moves inside stationary anatomical clips, avoiding a second moving
silhouette over a static tree. These layers receive the same Brasilia lighting.

## Assets and generation

Built-in imagegen, not the CLI, prepared two cloud-free backgrounds:

- `build/emscripten/art/menu-sky-clean.png` (1672 x 941).
- `build/emscripten/art/menu-sky-clean-portrait.png` (941 x 1672).

No animal was regenerated. Their original pixels remain the animation source.

Final landscape prompt:

> Use case: precise-object-edit. Edit this exact 1672x941 clean garden background plate. Remove ONLY every white cloud in the sky, reconstruct the same smooth blue sky gradient behind their precise silhouettes. All clouds must be gone, no new clouds. Keep sun, mountains, all trees, forest, grass, flowers, river, water highlights, flag, hole, bridge, and stationary red-roof windmill exactly unchanged and at exactly the same coordinates. Keep the empty foreground without animals and the windmill without sails, as in input. NO text, no characters, no design changes. Same 1672x941 dimensions, same camera, exact composition, no cropping. This is a clean plate for the original cloud pixels to move independently over it. Preserve original background colors and style as closely as possible.

Final portrait prompt:

> Use case: precise-object-edit. Edit this exact 941x1672 clean portrait garden background plate. Remove ONLY every white cloud in the sky, reconstructing the same smooth blue sky gradient behind their exact silhouettes. No clouds left, no new clouds. Keep the sun, all trees, mountains, forest, river, water highlights, grass, flowers, flag, hole, bridge, parrot post and stationary windmill building exactly unchanged and at the exact same positions. Keep foreground empty of animals and windmill without sails. No characters, no text, no changes to framing or lighting. Same 941x1672 dimensions and original artistic style. This clean plate will receive separately animated original cloud pixels, so preserve all surrounding pixels as closely as possible.

## Visual validation

`server/test/menu-motion.mjs` uses a real desktop Chromium renderer at 1920x900
under both motion preferences, plus a mobile viewport. It saves automatic
before/after screenshots, verifies automatic mill transform progression,
checks that a frozen scene produces identical PNG pixels, and then compares
rendered screenshots for each isolated movement: mill, clouds, water, wind,
breathing, head, ears, tail and blinking. It also checks Frida's body source
alpha, proving neither a static right tail nor a second left appendage remains.
Campaign, Multiplayer, Exit and return navigation are exercised afterward.

The mixed-language multiplayer regression also caught a real return-navigation
race: leaving during asynchronous course loading could leave the native client
in IN_GAME after its online flag was cleared. The native bridge now completes
that return to the main menu once the outstanding load finishes. `home.js`
retains a Campaign request until the native menu acknowledges readiness,
cancelling it if the player chooses another route. Authority physics is untouched.

Images are written to `out/menu-motion`. These rendered images must be visually
inspected in addition to the test assertions. `living-menu.mjs` retains the four
Brasilia periods, palette continuity, contrast and pause/resume tests.
