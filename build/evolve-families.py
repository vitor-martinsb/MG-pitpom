"""Sixty authored, cumulative evolutions of the twenty immutable original maps."""
from pathlib import Path
import argparse,base64,copy,hashlib,importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('evolution_mesh',Path(__file__).with_name('evolution-mesh.py'))
mesh=importlib.util.module_from_spec(spec);spec.loader.exec_module(mesh)
ORDER=[3,2,4,1,*range(5,21)]

# Each row is an authored operation, applied to the immediately preceding stage.
# W: corridor deformation (axis, centre, radius, cross-axis, shift, narrowing, pivot).
# R: irregular natural deflector (x,z,floor,rx,rz,height,yaw).
# M: existing mover timing (entity index, period, phase); B: existing bump height.
DESIGNS={
 1:[ [('W',2,-8,3,0,0,.12,-.5),('R',-.5,-9,-.375,.38,.45,.38,0)],
     [('W',2,-9,4,0,2.2,.25,-.5)],
     [('W',2,-12,2.5,0,-2.2,.20,-.5),('R',-1.3,-12.7,-.375,.23,.4,.38,.3)] ],
 2:[ [('W',2,-8,3,0,0,.12,-.5)], [('W',0,2,4,2,.55,.10,-12.75)], [('R',5,-11.2,-.375,.45,.28,.38,.5),('W',0,6,2,2,-.3,.10,-12.75)] ],
 3:[ [('B',6,.035),('B',9,.025)], [('B',7,.035),('B',10,.045),('S',[(-2.65,-7.5),(-2.45,-10),(-2.7,-12.7)],.55,-.4)], [('B',8,.04),('B',11,.05),('W',2,-7,2,0,.45,.12,-.5)] ],
 4:[ [('M',4,4,.5),('M',5,4,1)], [('W',0,4,2,2,.35,.08,-20.75),('M',9,3.7,.7)], [('M',4,3.5,1),('M',5,3.7,0),('W',2,-12,2,0,-.2,.13,14.5)] ],
 5:[ [('W',0,19,3,2,.25,.08,-13.75)], [('S',[(20.5,-16.05),(18.8,-15.8),(17.1,-16.1)],.6,-.4)], [('W',0,21,2,2,-.3,.12,-13.75)] ],
 6:[ [('M',7,3,.25),('M',10,3,.8)], [('M',12,3.5,1.2),('M',14,3.5,.4),('W',2,-9,3,0,.2,.08,7.75)], [('M',7,3.2,.4),('M',10,3.7,1.1),('W',2,-20,2,0,-.25,.14,7.75)] ],
 7:[ [('S',[(-2.7,-7),(-2.5,-8.3),(-2.7,-10),(-2.4,-11.5)],.65,-.525)], [('W',2,-7,2,0,.45,.10,-.5)], [('W',2,-12,2,0,-.35,.12,-.5),('R',1.1,-11.8,-.5,.25,.38,.35,0)] ],
 8:[ [('W',2,-12,2,0,.25,.08,-.5)], [('S',[(7.5,-6),(7.25,-8),(7.5,-10.5)],.55,2.225)], [('W',2,-5,1.6,0,-.25,.12,5.5)] ],
 9:[ [('M',9,3.3,.5)], [('W',2,-27,2,0,.3,.12,3)], [('M',9,3.7,1.3),('R',7.7,-25.3,-.5,.32,.28,.4,.4)] ],
 10:[ [('W',0,19,3,2,.3,.08,-8.75)], [('S',[(1,-35.8),(-1,-35.5),(-3,-35.8)],.55,-.525)], [('M',9,3.6,.9),('B',13,.025),('B',16,.025)] ],
 11:[ [('M',8,3.3,.25),('M',13,3.3,1.7)], [('M',15,3.7,.5),('M',17,3.7,2),('W',0,19,2.5,2,.15,.08,-8.75)], [('M',8,3.9,.8),('M',13,3.9,2.1),('W',0,20,2,2,-.2,.12,-16.25)] ],
 12:[ [('W',0,5,3,2,.15,.08,-19.25)], [('S',[(6,-21.4),(8,-21.1),(10,-21.4)],.55,-.4)], [('W',0,10,2,2,-.15,.13,-19.25)] ],
 13:[ [('M',11,4,.7),('M',12,4,2)], [('W',2,-18,2,0,.3,.10,3),('M',13,2.7,.6)], [('M',11,3.7,1),('M',12,4.3,2.2),('W',2,-2,2,0,.15,.12,-.5)] ],
 14:[ [('W',2,-19,3,0,.2,.08,14.5)], [('S',[(16.4,-17),(16.1,-19),(16.4,-21)],.55,-.4)], [('W',2,-2,2,0,-.15,.13,14.5)] ],
 15:[ [('M',9,3.3,.2),('M',12,3.3,1.5)], [('M',14,3.7,.8),('W',2,-2,1.7,0,.15,.09,20.75)], [('S',[(-11.2,-2.8),(-11,-3.6),(-11.2,-4.4)],.55,1.85),('W',2,-4.7,1.3,0,-.15,.10,20.75)] ],
 16:[ [('M',7,3.6,.35)], [('S',[(2.5,-5),(5.5,-6.3),(8.5,-5)],1.5,-.4)], [('M',7,4.1,.65),('W',2,-17,3,0,.2,.12,1.5)] ],
 17:[ [('M',14,4,.4),('M',16,4,1.8)], [('M',12,3.5,.5),('M',17,4.3,.5),('W',2,-16,2,0,.15,.07,24)], [('M',18,4.7,1.3),('W',2,-29,1.8,0,-.2,.11,24)] ],
 18:[ [('M',9,3.3,.3),('M',12,3.3,1.9)], [('M',14,3.7,.7),('W',0,-6,2,2,.3,.08,0)], [('M',16,4.1,1.8),('W',0,-2.5,1.3,2,-.2,.12,0)] ],
 19:[ [('ROT',9,8),('ROT',11,-8),('ROT',16,6)], [('S',[(11.7,7.4),(9.1,10.6),(5.7,12.7)],.55,-.4),('ROT',13,7)], [('W',0,-10,3,2,.2,.10,7),('ROT',14,-8),('ROT',15,7)] ],
 20:[ [('M',8,3.6,.3),('M',9,3.6,1.4)], [('M',10,4,.7),('M',11,4,2.1),('W',0,-5,2,2,.1,.07,-6.5)], [('M',7,4.3,1.1),('S',[(-14,1),(0,0),(9,1)],2,0),('W',0,-19,2,2,-.1,.10,-6.5)] ],
}

def prepare(level):
    white=base64.b64encode((ROOT/'data/textures/colors/white.png').read_bytes()).decode()
    # Reuse the live garden lighting rather than duplicate ~60 MB of baked
    # lightmap PNGs. Original courses keep their complete, untouched lightmaps.
    level['lightmap_images']=[dict(name='evolution',resolution=1,time_length=0,repeats=False,datas=[white])]
    for entity in level['entities']:
        if 'lightmap_section'in entity:entity['lightmap_section']['lightmap_name']='evolution'
    level['materials'].extend([
        dict(name='evolution-rock',friction=.3,restitution=.65,vel_scale=.9,type='environment',texture='data/textures/environment/slab.jpg'),
        dict(name='evolution-water',friction=0,restitution=0,vel_scale=0,type='environment',texture='data/textures/environment/water.jpg')])

def apply(level,operation):
    kind,*args=operation
    if kind=='W':mesh.warp(level,*args)
    elif kind=='R':mesh.rock(level,f'evolution-rock-{len(level["entities"])}',*args)
    elif kind=='S':mesh.stream(level,f'evolution-stream-{len(level["entities"])}',*args)
    elif kind=='M':
        index,period,phase=args;level['entities'][index]['movement'].update(length=period,t0=phase)
    elif kind=='B':
        index,raise_by=args;e=level['entities'][index];p=e['geo']['p'];minimum=min(p[1::3])
        for i in range(1,len(p),3):
            if p[i]>minimum+.01:p[i]=round(p[i]+raise_by,6)
    elif kind=='ROT':
        import math
        index,degrees=args;e=level['entities'][index];angle=math.radians(degrees)*.5
        q=e['transform']['rotation'];x,y,z,w=q;c=math.cos(angle);s=math.sin(angle)
        e['transform']['rotation']=[c*x+s*z,c*y+s*w,c*z-s*x,c*w-s*y]

def make_family(family,check=False):
    original=ORDER[family-1];level=json.loads((ROOT/f'data/levels/level-{original}.level').read_text())
    prepare(level);result=[]
    for revision,operations in enumerate(DESIGNS[family],1):
        parent=copy.deepcopy(level)
        for operation in operations:apply(level,operation)
        # Metadata is added only to the written copy, never fed back as geometry.
        output=copy.deepcopy(level)
        number=(family-1)*4+revision+1;world=(family-1)//2+1;stage=(family-1)%2*4+revision+1
        output['entities'].append(mesh.group(f'campaign:{world}:{stage}:{number}'))
        start=next(e for e in output['entities']if e['type']=='ball-start')['transform']['position']
        hole=next(e for e in output['entities']if e['type']=='hole')['transform']['position']
        for kind in range(3):output['entities'].append(mesh.group(f'animal:{kind}',[a+(b-a)*(.25+kind*.25)for a,b in zip(start,hole)]))
        text=json.dumps(output,separators=(',',':'))+'\n';path=ROOT/f'data/campaign/family-{family:02d}-{revision}.level'
        if check:
            assert path.read_text()==text,f'Stale evolution {family}.{revision}'
        else:path.write_text(text)
        result.append(dict(family=family,revision=revision,path=str(path.relative_to(ROOT)).replace('\\','/'),parent=f'{family}.{revision-1}'if revision>1 else str(family),operations=operations,sha256=hashlib.sha256(text.encode()).hexdigest()))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--family',type=int);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for family in ([args.family]if args.family else range(1,21)):
        rows=make_family(family,args.check);print(f'Family {family}: '+', '.join(str(r['revision'])for r in rows),flush=True)
