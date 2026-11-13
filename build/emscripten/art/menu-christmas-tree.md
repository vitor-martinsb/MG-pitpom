# Christmas menu decorations

`menu-christmas-tree.png` is a transparent scenery sprite generated with the built-in image_gen tool. The original generated file is retained in `/workspace/generated_images/exec-aac6076a-c48a-42f9-b07b-155ffb47d0a6.png`.

Direction: an organic, hand-painted evergreen for the existing summer-garden illustration, with olive foliage, burgundy bows, antique-gold ornaments and gifts. No snow, background, lettering or characters. It replaces the old flat triangular Canvas tree; the menu background and all seven pets are unchanged.

The seasonal renderer lazily loads this resource only for Christmas. Its ambient RGB follows the existing Brasilia day/sunset/night clock, preserving the sprite alpha. Warm bulb emission is rendered separately. The foliage tint is cached at a small resolution and updated only when lighting changes. Canopy strands and fabric bows use the same restrained palette; lights remain gently lit rather than flashing.

Daylight keeps the lamps as softly shaded glass with negligible bloom. Sunset warms foliage, bows and gold ornaments and gradually introduces an amber glow; full warm emission is reserved for night. All variants use the same sprite and the same menu artwork.

The surrounding scenery now carries curved evergreen garlands on the fence and bridge, shaded red fabric bows, red and gold hanging baubles, a wreath on the windmill and small lanterns on the bridge posts. Presents occupy the open grass, and the tree is larger. Separate portrait and landscape anchors follow the existing artwork without moving or dressing any pet. The top lights hang in short scallops instead of stretching as one nearly straight wire across desktop screens.

All materials use the same ambient lighting as the tree. Daytime glass keeps its color and highlights; warm emission increases smoothly at sunset and night. Bulbs vary by only three percent, without switching off or flashing. No new particles, textures, gameplay or physics are introduced. Validate using `node test/seasonal.mjs --menu-only` in `server`: it covers six viewport sizes, four times of day, unchanged pet pixels and placement, clear space around pets, theme restoration and one shared lazy-loaded sprite.
