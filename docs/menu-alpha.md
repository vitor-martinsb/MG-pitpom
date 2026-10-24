# Menu alpha and reference-character repair

The background illustrations are opaque RGB PNGs. The cyan tree rim was caused
by the renderer moving an opaque crop containing sky and mountain pixels inside
a coarse vegetation clip. It was not a CSS drop shadow or a damaged alpha
channel in those background files.

The stationary background now owns each tree's original outer silhouette.
Wind layers use a cached RGBA leaf-pigment source, with sky and mixed blue edge
pixels excluded from alpha. A stationary alpha mask bounds those moving pixels.
The source foliage colors are retained; no recoloring, blur, extra outline or
shadow hides the boundary. Moving clouds also use complete original cloud
silhouettes, rather than fragments cut off by the source viewport or trees. Internal leaf movement, clouds, water and mill motion
continue. Image reads and alpha preparation run only when building an orientation,
not every animation frame.

The user's five-animal transparent reference was used to export independent RGBA
layers with the built-in image generation/editing tool. The exports retain the
original reference canvas coordinates and character features. Their file names
are `art/menu-pet-{luna,romeu,frida,pituca,pompom}.png`. Small differences in empty
canvas height do not affect placement: the renderer reads explicit source bounds,
uses one uniform scale and keeps each existing foot anchor in both layouts.
No whole-scene rescaling, gameplay, map or character-model change is involved.
The established bird remains as the sixth scene character.

The renderer no longer draws an extra black stroke over animal cutout boundaries
or derives the five animals' silhouettes from the lawn image. Body, head, ear and
single tail layers use the exported alpha. Frida keeps her closed-eye expression;
Pituca has no invented tail. Existing night palettes, breathing, head/ear motion,
blinking, pause/resume and gentle reduced-motion behavior are retained.

`server/test/menu-alpha.mjs` checks served reference assets, decoded moving-leaf
RGBA (no opaque cyan sky), stable frozen compositing, different motion phases,
reference eye/tail features, touch/desktop controls and pause/resume. It saves
phase screenshots to `out/menu-alpha` for visual inspection.
`menu-motion.mjs` also compares rendered frames for each existing motion, and
`living-menu.mjs` exercises the four Brasilia-time lighting periods and navigation.

The unrelated generated vegetation extraction candidates were rejected during
visual review and are not application assets. The shipped background trees and
their colors remain the original illustrations.
