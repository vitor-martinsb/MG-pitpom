# Multiplayer entry and lobby

The welcome route offers Create room and Join room. Create uses the saved
profile (or Player/default cosmetics) and immediately enters the existing room
as host. Join opens a code/nickname form. Ball color and avatar are edited only
after entering a room, through the personal card on the Players tab.

The existing `room` WebSocket state remains authoritative. Players, Maps and
Mode are panels of that same lobby; changing tabs does not send configuration
requests or rebuild their controls. The room header and footer sit outside the
scrolling panel. Safe areas and `visualViewport` resizing keep inputs reachable
with the mobile keyboard open. Tabs support arrow/Home/End keyboard navigation.

`profile` is the only additional WebSocket intent. It updates the authenticated
sender in `Room.updateProfile`, only in the lobby, using the existing nickname,
color and avatar validation. An `id` in the message cannot target another member.
The server publishes the normal room message to everyone, and the existing
native bridge updates both color and avatar. Saved preferences reflect the
accepted server state. Room, bot, map and start permissions remain unchanged.

Map selection groups the existing 80 courses by world, with expandable course
lists. Worlds support partial selection. Draft checkboxes survive tab switches
and unrelated room publications. Apply selection uses the existing `map-pool`
intent. Start also applies a pending custom draft, clamps the requested course
count to it, then uses the existing start/unique shuffle/loading pipeline.
Configuration requests disable Start until their authoritative acknowledgement.
Classic and Collision cards map to the existing `classic` and `impact` values;
no physics or first-shot protection rules are changed.

Bots use the existing add/update/remove/count events. Easy, medium and hard are
available alongside the preserved expert difficulty. Bulk bot setup is folded
away; the shared human-plus-bot capacity is still 50. Guests see the roster,
difficulty and match settings, and can edit only their own profile.

`lobby-profile.test.ts` checks validation, sender ownership, publication and
host permissions. `lobby-tabs.mjs` checks the real two-client flow, custom
profiles, map/world drafts, mode acknowledgements, capacity, guest controls,
keyboard sizing, footer placement and starting without repeat courses.
`lobby-webkit.mjs` runs that same integration against WebKit in CI. Existing
browser regressions use the public create/join/profile/tab helpers in
`navigation-fixture.mjs`; no hidden pre-entry setup form is retained.

The illustrated entry keeps the original `GolfMenuScene` mounted behind its
transparent controls, including the original animals and motion. It does not
create a second scene or re-encode the artwork. The in-room panels use a green
header, segmented tabs and cream cards. Color/avatar shortcuts edit the same
profile form fields and wait for the same server acknowledgement. The mode
illustrations are static UI diagrams; the physics values remain unchanged.

The personal card title is the accepted nickname. Avatar IDs 0–6 identify
Pituca, Pompom, Romeu, Luna, Frida, Juju and Cocota; ID 7 shows the pet group,
preserving all eight saved/protocol values. Portraits display the unmodified
menu atlas. Settings are available only on the main menu and inside matches,
including solo play; entry, lobby and loading keep them closed and hidden.
