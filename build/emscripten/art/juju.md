# Juju

`juju-mud.png` is an original transparent illustration generated with the
built-in imagegen tool using the supplied real calico photo for identity and
the existing menu garden for character style. The generated alpha is preserved.
No existing menu animal or background was replaced. The introduction opens
from **Meet Juju** in the main menu, with English, Brazilian Portuguese and
Spanish descriptions.

Final prompt (built-in tool, transparent background):

> Use case: illustration-story. Create ONE new transparent game character illustration asset for PitPom Minigolfe. References: real calico cat photo = identity markings; garden menu illustration = exact character art style (rounded cute proportions, large expressive eyes, warm flat shading, clean dark outlines). Subject Juju, a female calico kitten, mostly white face/chest/paws with orange patch and ear on viewer left forehead, black patch and ear on viewer right forehead, irregular black and orange patches across back, ONE long calico tail. Relaxed lying down, body elongated horizontally, front paws forward, head upright turned slightly toward viewer, tranquil mischievous expression. Lying IN a small warm brown mud puddle; visible cute brown mud on paws and a few small spots on white fur. Include the complete puddle as part of subject with smooth organic outline. Keep pristine clean silhouettes/antialiased transparent edges, no background halo. Match the existing orange and gray menu cats' simple soft cartoon style faithfully. Transparent background outside cat and puddle, no landscape, no text, no frame, no extra animals, no objects. Full body and tail fully inside image with margin. A finished production character asset, not a sketch.

## Gameplay

Juju joins the third-companion pool (kind 3), preserving the permanent Pituca
and Pompom and excluding the previous field's companion. She rests in a mud
puddle, breathes, blinks, flicks her single tail and swipes her front paw.
The contact edge/cooldown prevents repeated slaps while the ball stays beside her.

Effect 6 applies a bounded 31.5 degree sideways tap and three personal future
shots. The triggering shot does not consume one. Only accepted, completed shots
consume the counter; idle time, invalid input, another player's strokes and
duplicate notices do not. A new contact can refresh it to three. Hole resets
clear it. Romeu's puddle and its separate three-shot slow effect are unchanged.

Each muddy shot launches at 82% normal speed, through the same modifier used by
the solo and multiplayer launchers. Measured distance is 67.3% of the clean
ball's distance at three tested powers on the original flat course.
Small deterministic steering
preserves horizontal speed and avoids vertical physics impulses. Brown surface
clumps diminish with the counter; tiny hops/wobble are render-only, preserving
the collision sphere. The last traces shrink away over 0.65 seconds after the
third completion. Snapshots carry the counter and fade deadline, so reconnects
use server state. Sounds use the existing procedural audio mixer.

Native coverage: `juju_mud_three_shots`. Browser coverage:
`server/test/juju-browser.mjs`, plus existing wildlife/render/navigation suites.
`juju_placement_*` validates all 80 courses. The overpopulated renderer fixture
also fits 50 muddy balls and all four optional animals into 39108/40960 vertices;
the normal game still renders only one optional companion alongside the mascots.
