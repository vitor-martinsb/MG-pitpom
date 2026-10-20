# Twenty-course restoration

The playable catalogue uses exactly the twenty maps and ordering from commit
`ecaf879c1611601931338dfe5c234e01db22de89`. The level files and model assets retain
their original hashes. The 100 generated courses and their layout generator have
been removed. Existing original-course progress uses its original save keys.

Ten music/visual themes are retained, each covering two original courses. Animals
are placed deterministically on reachable floor with clearance from the start,
hole, moving obstacles and other animals. If there is insufficient safe floor,
an animal is omitted rather than placed inside a wall. No map geometry is changed.

Luna follows the supplied black low-poly dog artwork, with brown eyes, compact
proportions and angular ears whose tips fold forward. Frida remains the white and
gray cat from the earlier photo, as explicitly clarified by the user; the dark dog
description in the pasted prompt does not apply to her.

Luna, Frida and Romeu now share Pompom's diagonal four-leg step. Their phase follows
actual travelled distance and their gait blends with speed; stationary animals
stop stepping. Pompom's phase follows the distance along her sinusoidal crossing,
and stops when that crossing has zero span. Pituca remains lying in place, facing
the incoming ball. Existing animal actions, effects and multiplayer replication
are preserved, including Romeu's three-completed-stroke puddles.

The Poppins fonts, clean minimap, surrounding forest, bot difficulties, chat,
loading artwork, sound and music remain in place. Restored map obstacles retain
their original authored geometry, taking priority over generated-course rocks.

Validation uses the original immutable hashes, the 20-course catalogue, native
physics and mechanics, authoritative multiplayer, and desktop/mobile browser
rendering. Bot compatibility checks execute four real planned shots per original
course; they do not guarantee a bot finishes every original course. A separate
`golf_campaign_test <level> --solve` runs the 90-shot completion witness: initial
attempts on original maps 11 and 20 exceeded 120 seconds. Their authored layouts
and the bot planner are preserved. Older campaign documents describe the
superseded 100-course version.
