# Menu readiness and static campaign scenery

The welcome screen waits for the native menu state, the responsive menu artwork
and browser fonts before exposing its controls. Campaign, Multiplayer and Exit
share one visible menu group and are enabled before it is shown. Clicks and
Enter/Space cannot bypass startup preparation.

The text-free `menu-garden.png` and `menu-garden-portrait.png` compositions fill
100% of the available viewport using `object-fit: cover`, without stretching.
Portrait phones use the tall composition; desktop and landscape use the wide
composition. Both images and the Poppins font weights are prepared before
startup finishes. The title and the welcome button are localized HTML, with no
painted button baked into the background. The three main choices appear only
after continuing; the welcome button is hidden on that menu. The multiplayer
connection panel has no decorative image; player, room and bot controls are
unchanged.

Campaign `.map-decoration` groups retain their SVG placement without CSS sway.
The animated water, windmill, loading mascots and progression indicators remain.
No course data, ball physics or scoring rules were changed.

Validation: `cd server && npm run test:menu`. This regression delays the menu
image, checks all three buttons on every animation frame, checks edge-to-edge
desktop/portrait/landscape layouts and the separate welcome button, and compares
static scenery matrices over time while verifying that water and windmill
animations remain enabled. `node test/home-navigation.mjs`
covers real campaign navigation, saved scores, multiplayer bot management and
reconnection on desktop and mobile. Both checks run in the validation workflow.
