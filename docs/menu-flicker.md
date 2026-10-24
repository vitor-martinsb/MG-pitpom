# Menu compositing and CI timing

The animated SVG lighting filters previously used object bounding boxes. The
background's bounds included offscreen cloud tiles, while the pets' bounds
followed their animated parts. Those changing filter surfaces risk clipping or
losing layers on mobile compositors. Both filters now use fixed scene-space
bounds: the visible viewport for scenery and the cached sprite union plus
motion padding for animals. The rendering assets, poses and animation clocks
are unchanged.

The one-second Brasilia clock now writes filter matrices, opacity and palette
properties only when values actually change. Stable lighting does not invalidate
all animated layers every second; sunset/night transitions still update their
colors normally. No animation is disabled as a flicker workaround.

`server/test/menu-flicker.mjs` runs real continuous animation starting at 19:04
Brasilia time. It samples opaque tan chest/leg pixels from Luna's actual body
sprite, projects them into successive screenshots, and checks that the torso
stays visible. Desktop and mobile (3x device density) are covered. It also checks
fixed filter bounds, continued mill motion, zero redundant stable-night matrix
writes, and navigation. Screenshots go to `out/menu-flicker`.

The failure in staging run 40135407240 was a separate assertion in
`loading-audio.mjs`: "continuous travel" assumed a fixed sampling interval, even
when the runner delivered frames later. The check now samples on animation
frames and bounds displacement by actual elapsed render time and orbit speed.
It deliberately misses a 760ms sample to exercise that case. Sprite separation,
eight-frame coverage, speed, resize, audio and mute checks remain enforced.

CI still runs every existing browser script. The validated container exports its
runtime web files and native worker once; three browser jobs download that exact
build and run menus, courses, and audio/updates in parallel. Downloaded worker
permissions are restored explicitly. Failed jobs retain their screenshots. This
avoids crowding all 16 browser scripts into the original 35-minute container job
without skipping any checks or extending the timeout.
