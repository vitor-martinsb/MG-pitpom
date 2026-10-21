# Ball recovery and river transport

Out-of-bounds recovery uses shared C mechanics in solo and on the authoritative
multiplayer worker. Capture kind 5 locks shots for 3.2 seconds: the maritaca
approaches for 0.6 seconds, carries the ball along a smooth arc for 1.8 seconds,
then departs for 0.8 seconds. The ball returns to its actual last-shot position
without adding a stroke or clearing Romeu's three-shot slowdown. Reconnection
receives the same capture kind, start time and authoritative ball position.

The bird is a small procedural mesh with a green coat, darker wings, red shoulder
patches and ivory hooked beak. It uses the existing actor buffer, has no collider
and is absent from the minimap. No external artwork or new runtime allocation is
required. Recovery has no full-screen flash, camera angle reset or error sound.
Camera following now uses a time-based easing and stays above the course floor.

Flowing water supports a descending ball at half its radius above the surface while
applying a normalized horizontal current with a faster steering response in
bends. This prevents sinking
through original rivers without a solid bed. A water contact takes precedence
over a coincident out-of-bounds plane, including its collision response;
ignored contacts and water entities cannot
trigger out-of-bounds recovery. After leaving water, ordinary gravity and solid
collisions resume. Submerged bed ramps cannot bounce a descending ball out of
the current. Still-water hazards retain gravity and recovery behavior. River
entry ramps, bridge collisions and authored flow vectors
remain in use.

Native regression tests cover continuous transport with a coincident kill plane,
current seam/timestep invariance, and 50 simultaneous rescues with locked input,
continuous motion, exact last-shot return and retained scores/slowdown. Browser
validation exercises recovery through the trusted snapshot transport on desktop
and mobile and checks rendering errors and actor capacity.

The isolated bot planner has up to 30 seconds for a search, matching graph
preparation; live worker commands retain their 5-second deadline. A long river
forecast must not cancel a valid expert decision or block authoritative frames.
