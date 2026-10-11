"""Ensure the visual redesign leaves the original maps, colliders and rules intact."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'tests/fixtures/gameplay-before-garden.json').read_text(encoding='utf-8'))
def digest(path):
    data = path.read_bytes()
    if path.suffix in {'.c', '.h', '.obj', '.mtl', '.level', '.json', '.ts', '.txt'}:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()
changed = [name for name, expected in manifest.items()
           if not (root / name).is_file() or digest(root / name) != expected]
if changed:
    raise SystemExit('Gameplay assets changed: ' + ', '.join(changed))
print(f'{len(manifest)} original map, model and gameplay files retain their SHA-256 hashes.')
