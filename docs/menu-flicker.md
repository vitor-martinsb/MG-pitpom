# Menu character compositing and CI timing

The Android report persisted after stabilizing SVG filter bounds. The pets now
paint together onto a single unfiltered HTML Canvas 2D surface, outside the scenery SVG. The SVG rig retains
the original motion timelines and pivots as an invisible motion model; it never
paints character layers. The painter reads those transforms and draws the same
reference parts in the same order, preserving straight alpha. It requests a
software raster backing so only the completed character frame is composited.

Character lighting is applied to cached sprite pixels only when the palette
changes. The character SVG filter has been removed. The scenery retains its
fixed scene-space filter and only updates lighting attributes when values change.
No reference assets, poses, placement, motion timing or gameplay resources change.

The character backing has fixed bounds around the sprite union with motion
padding, follows viewport/device density with a 2x scene-resolution cap, and
avoids a full-screen bitmap. Hidden menus cancel paint requests; navigation
resumes the same clocks. Orientation changes replace the previous surface and
stop its painter before rebuilding.

`server/test/menu-flicker.mjs` starts at 19:04 Brasilia time on desktop and a
3x-density mobile viewport. It samples opaque interior pixels from all six actual
body sprites over 40 seconds per device, covering complete head, ear and blink
cycles. It checks both the painted pixels and periodic composited screenshots
against reference interior colors, verifies paint progress, pause/resume, and
both phone orientations. Captures go to `out/menu-flicker`.

The original `menu-motion.mjs` per-motion screenshot comparisons still verify
visible breathing, head, ear, tail, blink, wind, water, cloud and mill movement.
`living-menu.mjs` covers all four palettes, timezone independence, continuous
palette boundaries and navigation. Passing headless checks does not establish
that a particular Android GPU/browser combination is free of rendering issues.

The separate failure in staging run 40135407240 was in `loading-audio.mjs`:
"continuous travel" assumed fixed sample intervals even when the runner delivered
frames later. It now samples on animation frames and bounds displacement by
actual elapsed render time and orbit speed, deliberately missing a 760ms sample.
Sprite separation, eight-frame coverage, speed, resize, music and mute checks
remain enforced.

CI runs all existing browser scripts. The validated container exports its web
files and native worker once; three browser jobs download that exact build and
run menus, courses, and audio/updates in parallel. Worker permissions are restored
explicitly. Failed jobs retain screenshots. No checks are skipped and the
35-minute per-job timeout is unchanged.
