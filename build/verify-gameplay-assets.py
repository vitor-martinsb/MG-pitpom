"""Protect original map/model geometry and reviewed gameplay source baselines."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'tests/fixtures/gameplay-before-garden.json').read_text(encoding='utf-8'))
updates = root / 'tests/fixtures/gameplay-mechanics-baseline.json'
if updates.exists():
    # Reviewed mechanics and their physical regression test may change here.
    # Original map/model hashes retain their original, immutable baseline.
    overrides = json.loads(updates.read_text(encoding='utf-8'))
    allowed = {'server/native/worker.c', 'src/golf/physics.c', 'src/golf/game.c',
               'src/golf/online.c', 'server/src/room.ts','server/native/physics_test.c'}
    if set(overrides) != allowed:
        raise SystemExit('Unexpected mechanics baseline scope')
    manifest.update(overrides)
def digest(path):
    data = path.read_bytes()
    if path.suffix in {'.c', '.h', '.obj', '.mtl', '.level', '.json', '.ts', '.txt'}:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()
changed = [name for name, expected in manifest.items()
           if not (root / name).is_file() or digest(root / name) != expected]
if changed:
    raise SystemExit('Gameplay assets changed: ' + ', '.join(changed))
print(f'{len(manifest)} map, model and reviewed gameplay files retain their SHA-256 hashes.')
