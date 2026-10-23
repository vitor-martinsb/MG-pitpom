# Garden navigation

The browser always starts with a welcome screen. Click, touch, Enter or Space
opens a main menu with Campaign, Multiplayer and Exit. Exit returns to the
welcome screen in the browser. Settings remain available from the corner.
The welcome screen and main menu use the user-supplied garden reference, with
text removed and a portrait adaptation for mobile. Title, language controls
and all menu buttons remain real HTML. Artwork and the exact edit prompts
are documented in `build/emscripten/art/menu-garden.md`. Gameplay animals and
all map/model assets remain unchanged.

Campaign keeps the existing 80 courses, 20 families, 10 world names and score
keys. Each illustrated world has eight interactive nodes on a winding path.
Selecting a node shows its name and saved best; Play loads the real C course.
The optional progression setting still uses native sequential lock checks.
Records continue to live in IDBFS. New completions highlight the newly opened
path when the map is revisited. The same world navigation supports touch and
keyboard, with reduced-motion styles for environmental animation.

Multiplayer retains all room, capacity, AI naming, difficulty and host rules.
Participants, settings and bot controls have separate compact areas. Quantity
sets the desired total, + Add bot adds one, and each bot has immediate
difficulty/removal controls. Cosmetic editing is tucked into a disclosure.
Expert remains available alongside the three basic difficulties. A saved room
is reconnected when Multiplayer is selected after the welcome/menu flow.

`server/test/home-navigation.mjs` covers the welcome inputs, three menu choices,
desktop/touch layouts, all 80 nodes, world navigation, real IDBFS score fixtures,
native locked-level rejection, actual solo loading, three languages, bot CRUD,
host permissions, totals and reconnection. Existing browser regressions use
`navigation-fixture.mjs` to enter through the same visible controls.
