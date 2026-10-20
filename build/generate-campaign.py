"""Index the twenty preserved reference courses without rewriting geometry."""
from pathlib import Path
import argparse
import hashlib
import json
import importlib.util
spec=importlib.util.spec_from_file_location("families",Path(__file__).with_name("evolve-families.py"))
families=importlib.util.module_from_spec(spec);spec.loader.exec_module(families)

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = 'ecaf879c1611601931338dfe5c234e01db22de89'
ORDER = [3, 2, 4, 1, *range(5, 21)]

def outputs(check=False):
    config=json.loads((ROOT/'data/config/game.cfg').read_text())
    assert config['num_levels']==80
    worlds=json.loads((ROOT/'data/campaign/worlds.json').read_text(encoding='utf-8'))
    for i,w in enumerate(worlds):w['first']=i*8+1;w['last']=i*8+8
    courses,identities=[],[]
    for index,original in enumerate(ORDER):
        base_path=f'data/levels/level-{original}.level'
        raw=(ROOT/base_path).read_bytes().replace(b'\r\n',b'\n');base=json.loads(raw)
        hole=next(e for e in base['entities']if e['type']=='hole')['transform']['position']
        identities.append('{%d,{%s}}'%(len(base['entities']),','.join(f'{v:.6f}f'for v in hole)))
        evolved=families.make_family(index+1,check)
        for revision in range(4):
            number=index*4+revision+1
            path=base_path if revision==0 else evolved[revision-1]['path']
            assert config[f'level{number}']==path
            data=(ROOT/path).read_bytes().replace(b'\r\n',b'\n')
            operations=[op for row in evolved[:revision]for op in row['operations']]
            courses.append(dict(number=number,family=index+1,revision=revision,
                familyNameKey=f'family.{index+1}',displayNumber=revision+1,
                label=str(index+1)+(f'.{revision}'if revision else''),
                original=original,parent=None if revision==0 else (str(index+1)+(f'.{revision-1}'if revision>1 else'')),
                world=index//2+1,stage=index%2*4+revision+1,path=path,
                geometryHash=hashlib.sha256(data).hexdigest(),baselineHash=hashlib.sha256(raw).hexdigest(),
                animals=[0,1,2],features=[op[0]for op in operations],hasNewWater=any(op[0]=='S'for op in operations),operations=operations))
    manifest=dict(version=6,reference=REFERENCE,worlds=worlds,courses=courses,petRoster=dict(fixed=['pituca','pompom'],thirdCandidates=['romeu','luna','frida'],count=3))
    return {
        'data/campaign/manifest.json':json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',
        'build/emscripten/campaign-data.js':'window.GOLF_CAMPAIGN='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n',
        'src/golf/reference-courses.h':'/* Generated from the untouched reference maps. */\nstatic const struct { int entities; vec3 hole; } reference_courses[] = {\n'+',\n'.join(identities)+'\n};\n',
    }

def generate(check=False):
    for name, text in outputs(check).items():
        path = ROOT/name
        if check:
            if not path.exists() or path.read_text(encoding='utf-8') != text:
                raise SystemExit(f'Reference catalogue is stale: {name}')
        else: path.write_text(text, encoding='utf-8')
    print('80 courses: 20 immutable originals and 60 cumulative authored evolutions verified.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
