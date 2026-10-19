"""Small physical regression courses; never included in the player's campaign."""
import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('campaign', ROOT / 'build/generate-campaign.py')
campaign = importlib.util.module_from_spec(spec)
spec.loader.exec_module(campaign)

def floor(mesh, x0, x1, z0, z1, y0, y1=None):
    if y1 is None:
        y1 = y0
    mesh.face([(x1,y0,z0),(x1,y1,z1),(x0,y1,z1),(x0,y0,z0)])
    for x, reverse in [(x0,False),(x1,True)]:
        points=[(x,y0,z0),(x,y1,z1),(x,y1+.4,z1),(x,y0+.4,z0)]
        mesh.face(list(reversed(points)) if reverse else points,'wall')

def make(name, descending=False):
    template=json.loads((ROOT / 'data/campaign/course-001.level').read_text(encoding='utf-8'))
    mesh=campaign.Mesh()
    if descending:
        floor(mesh,-2,2,3,-5,2.4)
        floor(mesh,-2.6,2.6,-7,-16,.3)
        start=(0,2.4,1);hole=(0,.3,-14)
    else:
        floor(mesh,-2,2,3,-3,0)
        floor(mesh,-2,2,-3,-6,0,1.4)
        floor(mesh,-2.6,2.6,-8.5,-17,1.7)
        start=(0,0,1);hole=(0,1.7,-15)
    # Back/final walls catch an overshoot without closing the takeoff edge.
    mesh.face([(-2,start[1],3),(2,start[1],3),(2,start[1]+.5,3),(-2,start[1]+.5,3)],'wall')
    mesh.face([(2.6,hole[1],-17),(-2.6,hole[1],-17),(-2.6,hole[1]+.5,-17),(2.6,hole[1]+.5,-17)],'wall')
    entities=[campaign.entity('ball-start','ball-start',start,(.25,.25,.25)),campaign.entity('hole','hole',hole,(.4,.4,.4)),mesh.finish('campaign-fairway')]
    water=campaign.Mesh();water.face([(-8,-3,8),(8,-3,8),(8,-3,-23),(-8,-3,-23)],'water')
    entities.append(water.finish('jump-water','water'))
    template['entities']=entities
    path=ROOT / 'tests/fixtures' / f'bot-{name}.level'
    path.write_text(json.dumps(campaign.canonical(template),ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

if __name__=='__main__':
    make('ramp-gap')
    make('drop-gap',True)
