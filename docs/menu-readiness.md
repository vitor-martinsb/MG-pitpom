# Menu readiness and static campaign scenery

The welcome screen waits for the native menu state, the original supplied JPEG
and browser fonts before exposing its controls. Campaign, Multiplayer and Exit
share one visible menu group and are enabled before it is shown. Clicks and
Enter/Space cannot bypass startup preparation.

`build/emscripten/art/menu-supplied.jpg` is the unmodified 1280 × 720 image
provided for this change. The image uses `object-fit: contain`; the existing
localized HTML controls sit outside it. The previous generated artwork remains
available as an asset, but the multiplayer connection panel has no decorative
image. Player, room and bot controls are unchanged.

Campaign `.map-decoration` groups retain their SVG placement without CSS sway.
The animated water, windmill, loading mascots and progression indicators remain.
No course data, ball physics or scoring rules were changed.

Validation: `cd server && npm run test:menu`. This regression delays the menu
image, checks all three buttons on every animation frame, checks desktop/portrait/
landscape layouts, and compares static scenery matrices over time while verifying
that water and windmill animations remain enabled. `node test/home-navigation.mjs`
covers real campaign navigation, saved scores, multiplayer bot management and
reconnection on desktop and mobile. Both checks run in the validation workflow.
