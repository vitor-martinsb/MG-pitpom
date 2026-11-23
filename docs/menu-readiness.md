# Menu readiness and static campaign scenery

The welcome screen waits for the native menu state, the responsive menu artwork
and browser fonts before exposing its controls. Campaign, Multiplayer and Tutorial
share one visible primary group and are enabled before it is shown. Clicks and
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
image, checks all three primary buttons on every animation frame, checks edge-to-edge
desktop/portrait/landscape layouts and the separate welcome button, and compares
static scenery matrices over time while verifying that water and windmill
animations remain enabled. `node test/home-navigation.mjs`
covers real campaign navigation, saved scores, multiplayer bot management and
reconnection on desktop and mobile. Both checks run in the validation workflow.

The home artwork now uses a dedicated, viewport-relative `home-art-floor`,
matching the established menu composition and independent of either button
layout. Portrait layouts reserve only 76 CSS pixels plus the bottom safe area
for the welcome action. The obsolete 158/208-pixel menu footer reservation is
removed, keeping the pets on the green beside the flag instead of lifting them
towards the landscape. Landscape/desktop placement is unchanged.
Opening or closing the menu cannot change the character group matrix
or the shared painter bounds. The three primary actions sit below the measured
brand/subtitle; Settings and Exit share a smaller secondary row. The original
Settings element moves into that row on the menu and returns to its game
location on navigation, retaining the existing controls and event handlers.

Only the control wrapper fades in (240 ms, opacity only). Pet animation clocks
pause during that transition and resume afterward, including rapid repeated
welcome/menu navigation; the scenery keeps its existing
animations. Reduced-motion preferences shorten the fade. Portrait layouts use
compact rows, with one row of modes on short phones; all actions retain at least
44 CSS pixels of touch height. Safe-area insets and an internally scrolling
Settings panel keep controls inside the viewport.

The readiness regression also checks identical welcome/menu character matrices,
no control overlap with any of the eleven pet targets, no page scrolling, and the
Settings panel bounds at six desktop/phone/tablet sizes. The seasonal regression
checks the unchanged animal artwork and composition with the Christmas subtitle
and decorations across daytime, sunset and night.

Desktop landscape layouts at 900 CSS pixels and above with hover input use two staggered rows
inside the curved foreground green. The welcome action shares the measured
title anchor instead of covering the front row. Small landscape and portrait
layouts keep their established positions. Responsive coverage includes the
reported 1805×830 viewport and 1920×1080 desktop screens. Alfredo uses the latest
supplied reference with a transparent background and an intact full-body sprite.
