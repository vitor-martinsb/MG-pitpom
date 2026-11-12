# Christmas menu decorations

`menu-christmas-tree.png` is a transparent scenery sprite generated with the built-in image_gen tool. The original generated file is retained in `/workspace/generated_images/exec-aac6076a-c48a-42f9-b07b-155ffb47d0a6.png`.

Direction: an organic, hand-painted evergreen for the existing summer-garden illustration, with olive foliage, burgundy bows, antique-gold ornaments and gifts. No snow, background, lettering or characters. It replaces the old flat triangular Canvas tree; the menu background and all seven pets are unchanged.

The seasonal renderer lazily loads this resource only for Christmas. Its ambient RGB follows the existing Brasilia day/sunset/night clock, preserving the sprite alpha. Warm bulb emission is rendered separately. The foliage tint is cached at a small resolution and updated only when lighting changes. Canopy strands and fabric bows use the same restrained palette; lights remain gently lit rather than flashing.
