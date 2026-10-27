# Juju

`juju-mud.png` is an original transparent illustration generated with the
built-in imagegen tool using the supplied real calico photo for identity and
the existing menu garden for character style. The generated alpha is preserved.
No existing menu animal or background was replaced. The main menu now uses
`menu-pet-juju.svg`, an editable vector illustration with green eyes, one tail,
calico markings and a mud puddle. It joins the canvas pet compositor with
independent breathing, blinks and ear/head motion; no extra menu button.

Final prompt (built-in tool, transparent background):

> Use case: illustration-story. Create ONE new transparent game character illustration asset for PitPom Minigolfe. References: real calico cat photo = identity markings; garden menu illustration = exact character art style (rounded cute proportions, large expressive eyes, warm flat shading, clean dark outlines). Subject Juju, a female calico kitten, mostly white face/chest/paws with orange patch and ear on viewer left forehead, black patch and ear on viewer right forehead, irregular black and orange patches across back, ONE long calico tail. Relaxed lying down, body elongated horizontally, front paws forward, head upright turned slightly toward viewer, tranquil mischievous expression. Lying IN a small warm brown mud puddle; visible cute brown mud on paws and a few small spots on white fur. Include the complete puddle as part of subject with smooth organic outline. Keep pristine clean silhouettes/antialiased transparent edges, no background halo. Match the existing orange and gray menu cats' simple soft cartoon style faithfully. Transparent background outside cat and puddle, no landscape, no text, no frame, no extra animals, no objects. Full body and tail fully inside image with margin. A finished production character asset, not a sketch.

## Gameplay

Juju joins the third-companion pool (kind 3), preserving the permanent Pituca
and Pompom and excluding the previous field's companion. She walks a validated safe
corridor, rests, blinks, flicks her single tail and swipes her front paw.
Legs follow distance-based gait. Alternating pawprints appear every 28 cm,
last 24 seconds and shrink during the final 3 seconds. A fixed 48-print ring
bounds memory, render and protocol cost. Authority and solo share the same
trail; snapshots and planner copies preserve its exact state. Continuous
trail contact does not refresh an already muddy ball. Pets and trail remain
absent from the minimap.
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
also checks 50 muddy balls and all four optional animals against 40960 vertices;
the normal game still renders only one optional companion alongside the mascots.

## Green-eye correction

Juju has green eyes in the presentation illustration and the 3D model.
The built-in imagegen tool edited the existing transparent asset with this prompt:

> Use case: precise-object-edit. Edit this exact existing transparent Juju game character illustration. Change ONLY the colored irises of BOTH eyes from amber/brown to clear natural leafy GREEN, with lighter green lower iris and darker green upper iris. Keep black pupils and white eye highlights exactly intact. Preserve every other detail: same calico cat identity, orange left forehead/ear and black right forehead/ear, white face/chest/paws, exact pose, expression, head and body proportions, outlines, fur patches, ONE tail, mud on paws/body, complete mud puddle, framing and original 1536x1024 size. Keep the actual transparent background and alpha edges. No new elements, no redraw, no changes outside the iris color. This is a minimal eye-color correction of the production asset.

## Updated menu cast

`menu-pets-juju.png` is the user's supplied six-character RGBA sheet, preserved
byte for byte. The menu now renders Luna, Romeu, Frida, Pituca, Pompom and Juju
from this same reference. The existing bird and landscape remain in place.
Runtime clips separate neighboring silhouettes and discard disconnected crop
residue before articulating each character on the existing single Canvas 2D
surface. Alpha edges are retained; no SVG filter surrounds the animal layer.

The five existing anchors are unchanged. Juju stands on the free front-left
green in landscape and the front-right in portrait, with enough space to keep
her paws and tail visible beside the controls. The gameplay model, green eyes,
three-shot mud state and synchronized muddy footsteps are unchanged.

## Walking and trail clarity

Juju's curled tail now rises with her hips in the walking pose, stays close to
her body and has a smaller tip sway. Turns ease through the patrol endpoints;
walking paws interpolate between authoritative updates.

Pawprints are smaller, spaced 28 cm apart and alternate sides behind her paws.
When she retraces the same corridor, nearby prints refresh instead of piling up.
Individual pads remain separate and the existing lifetime, three-shot mud effect
and server synchronization are retained. The native Juju test follows repeated
patrols and checks bounded turns, safe placement and minimum print separation.
