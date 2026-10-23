# Compact lobby and match display

The supplied garden illustration now also appears in the multiplayer header.
The welcome/main-menu landscape and portrait artwork remains the same reference.

The lobby lists humans and one collapsed bot summary with a count and a small
color preview. Expand it only to edit a specific bot. Individual rows are built
only while expanded. Quantity, group difficulty and + Add bot remain available;
host permissions and the 50-player room limit are unchanged.

The server assigns a distinct random, readable RGB color to each new default
bot. All clients receive that same color. Existing colors stay stable when
changing difficulty or reconnecting, and explicit host color choices are kept.

During solo or multiplayer play, the eye button hides/restores settings, the
minimap, the live scoreboard/HUD, actions, hints and player name labels. The
local preference persists across reloads. The eye button remains reachable;
aiming, mouse/touch shots and native pause/exit continue to work. Loading,
presentations, menus and mandatory results stay available. A manually opened
scoreboard or chat is closed when hiding information.

`server/test/clean-play.mjs` covers the 30-bot collapsed roster, replicated
colors, mouse/touch shots with the HUD hidden, preference after reconnect,
translated labels, essential results, and offline pause/exit. Server tests
verify distinct colors for 48 bots and stability across difficulty updates.
