# Living menu artwork and animation

The original `menu-garden.png` and `menu-garden-portrait.png` remain intact.
Animals, heads, ears, tails, sails and vegetation use clipped original pixels;
the clean plates fill the space behind the moving cutouts. No character was
regenerated. Pituca has no tail layer. Frida retains her closed-eye expression.

Project assets:

- `menu-living-clean.png` (1672 x 941).
- `menu-living-clean-portrait.png` (941 x 1672).

The two clean plates were prepared with the built-in imagegen tool, not the CLI.
The day/night references supplied by the user guided the lighting palettes.
The night palette adds a moon, stars and small warm lamps, with brighter character
lighting to preserve the illustration and readable faces. Morning and afternoon
use natural daylight, and sunset warms the sky and the interface.

## Final image prompts

Landscape:

> Use case: precise-object-edit. Edit target: the daytime 1672x941 garden illustration without title, provided last. The attached night scene is lighting reference only, do not use it as edit target. Create ONE production clean background plate in the EXACT same daytime framing and landscape art. Remove ONLY all six animals from the green foreground (black puppy Luna, black poodle Romeu, gray white cat Frida, green parrot, black-white tailless puppy Pituca, orange-white kitten Pompom), naturally fill those exact vacated silhouettes with matching green lawn, retaining their ground shadows if useful. Remove ONLY the four rotating wooden windmill sails and central axle disk; restore the stationary roof/wall/sky behind the sails. Keep the windmill building itself unchanged. Preserve every tree, sun, mountain, lake, bridge, flag, hole, plant, path, texture, grass tone and all positions exactly. NO animals anywhere. NO text. NO interface. Same flat warm illustrated style, same dimensions 1672x941, no camera or composition change. This is a clean plate over which exact original animal and sail pixels will be composited; surrounding pixels must match the original as closely as possible.

Portrait:

> Use case: precise-object-edit. Edit target is this exact 941x1672 portrait garden art. Make a production clean background plate for animation. Remove ONLY all six animals (all five dogs/cats on foreground grass and the green parrot on its post) AND ONLY the four windmill sails with their hub, restoring matching lawn/sky/roof behind those silhouettes. Keep the stationary windmill building, bird post, every tree, cloud, sun, grass patch, mountain, river, bridge, flag, hole and path in precisely the same places, colors, sizes and framing. No animals left. NO text or buttons. Keep exact 941x1672 composition and original gentle flat illustration. Do not redesign, zoom, relocate, recolor or add anything. Original animal pixels and sail pixels will be overlaid on this clean plate; surrounding pixels must remain as close to original as possible.

## Runtime

`menu-clock.js` explicitly formats time in `America/Sao_Paulo` using Intl.
Period names switch at 06:00, 12:00, 18:00 and 19:00 Brasilia time. Palettes
smoothly blend from the previous period over the first twelve minutes. The
menu samples time once per second while visible and refreshes on returning.
Device timezone changes do not affect these rules; the date uses the device's
current instant, as a normal browser clock does.

`menu-scene.js` mounts one visible SVG rig after decoding its assets. WAAPI
animations have different durations and offsets. Blink intervals vary within
each cycle, with eyelids attached to the moving heads. Plants share the same
gentle wind rhythm, and the windmill makes one turn every 72 seconds. The rig
does not restart when going between the welcome and main menu. Animations
pause without resetting while the menu/tab is hidden and respect reduced motion.
Only an orientation change rebuilds the rig for the corresponding artwork.
The original static image remains the fallback if a new asset cannot load.

Menu layout and navigation remain in `home.js`. Game physics, maps, saved
progress, multiplayer and audio controls are unchanged.

Validation: `menu-clock.test.ts` covers exact boundaries, midnight, timezones
and continuous interpolation. `living-menu.mjs` covers all palettes on desktop
and mobile, independent animations, no Pituca tail, pause/resume, reduced motion,
continuous time changes and existing campaign/multiplayer navigation.
