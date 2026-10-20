"""Index the twenty preserved reference courses without rewriting geometry."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = 'ecaf879c1611601931338dfe5c234e01db22de89'
ORDER = [3, 2, 4, 1, *range(5, 21)]

def outputs():
    config = json.loads((ROOT/'data/config/game.cfg').read_text())
    assert config['num_levels'] == 20
    worlds = json.loads((ROOT/'data/campaign/worlds.json').read_text(encoding='utf-8'))
    courses, identities = [], []
    for index, original in enumerate(ORDER):
        path = f'data/levels/level-{original}.level'
        assert config[f'level{index+1}'] == path
        raw = (ROOT/path).read_bytes().replace(b'\r\n', b'\n')
        level = json.loads(raw)
        hole = next(e for e in level['entities'] if e['type'] == 'hole')['transform']['position']
        identities.append('{%d,{%s}}' % (len(level['entities']), ','.join(f'{v:.6f}f' for v in hole)))
        courses.append(dict(number=index+1, world=index//2+1, stage=index%2+1,
                            path=path, geometryHash=hashlib.sha256(raw).hexdigest(),
                            animals=[0,1,2], features=[]))
    manifest = dict(version=3, reference=REFERENCE, worlds=worlds, courses=courses)
    return {
        'data/campaign/manifest.json': json.dumps(manifest, ensure_ascii=False, indent=2)+'\n',
        'build/emscripten/campaign-data.js': 'window.GOLF_CAMPAIGN='+json.dumps(manifest, ensure_ascii=False, separators=(',', ':'))+';\n',
        'src/golf/reference-courses.h': '/* Generated from the untouched reference maps. */\nstatic const struct { int entities; vec3 hole; } reference_courses[] = {\n'+',\n'.join(identities)+'\n};\n',
    }

def generate(check=False):
    for name, text in outputs().items():
        path = ROOT/name
        if check:
            if not path.exists() or path.read_text(encoding='utf-8') != text:
                raise SystemExit(f'Reference catalogue is stale: {name}')
        else: path.write_text(text, encoding='utf-8')
    print('Exactly 20 original reference courses, preserved order and catalogue verified.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
