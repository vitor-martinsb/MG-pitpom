# Romeu: three personal strokes of slowness

Contact with Romeu's pee applies a debuff to that ball. Leaving the puddle or
waiting does not remove it. The triggering stroke is excluded: the next three
valid completed strokes by the affected player are slowed. Other players' strokes,
duplicate requests, rejected shots and cancelled aiming do not consume it.

The next three launches use 65% of normal launch speed and keep the existing
additional rolling drag while moving. The effect ends after the third stroke
finishes. A fresh contact with Romeu can apply a new effect. Staying inside a
puddle does not repeatedly renew it; re-entering after expiry can apply it again.

The visible puddle remains, with its existing independent lifetime. Removing that
puddle does not clear a player's debuff. Both solo and the authoritative server
use this rule; snapshots include `slowShots`, including reconnect state. Starting
a new course clears the effect through the existing per-ball reset.

Native regressions cover persistence outside the puddle and after a long wait,
individual stroke counting, duplicates, invalid shots, reduced launch velocity,
expiry and the original puddle lifetime. Browser fixtures check replication of
3/2/1/0 remaining strokes to desktop and mobile without a visible puddle.
