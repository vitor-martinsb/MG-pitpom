"""Build the authored 10-world campaign using the existing .level geometry format.

No runtime random map generation: the checked-in manifest and all course meshes
are reproducible. The original twenty levels and their assets remain untouched.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import math
import struct

ROOT = Path(__file__).resolve().parents[1]
WORLDS = [
    ('tranquility', 'Bosque da Tranquilidade', 'Tranquil Grove', 'Bosque de la Tranquilidad', '#91b775'),
    ('zen', 'Lagoa Zen', 'Zen Lagoon', 'Laguna Zen', '#77b6b3'),
    ('meditation', 'Loop da Meditação', 'Meditation Loop', 'Bucle de la Meditación', '#afba8b'),
    ('hope', 'Salto da Esperança', 'Leap of Hope', 'Salto de la Esperanza', '#e3bf99'),
    ('winds', 'Jardim dos Ventos', 'Garden of Winds', 'Jardín de los Vientos', '#a6c7a6'),
    ('illusions', 'Vale das Ilusões', 'Valley of Illusions', 'Valle de las Ilusiones', '#bba6ce'),
    ('volcano', 'Vulcão da Paciência', 'Volcano of Patience', 'Volcán de la Paciencia', '#c98369'),
    ('stars', 'Labirinto das Estrelas', 'Star Labyrinth', 'Laberinto de las Estrellas', '#889ac6'),
    ('harmony', 'Caos da Harmonia', 'Harmonious Chaos', 'Caos de la Armonía', '#c5b67c'),
    ('enlightenment', 'Caminho da Iluminação', 'Path of Enlightenment', 'Camino de la Iluminación', '#ddc586'),
]
# Ten different route grammars, with increasingly long/precise combinations.
ROUTES = [
    [(0,0),(0,-10),(5,-16),(5,-23)],
    [(0,0),(0,-8),(-6,-12),(-6,-21),(1,-25)],
    [(0,0),(0,-9),(7,-9),(7,-20),(2,-25)],
    [(0,0),(0,-10),(-7,-10),(-7,-19),(1,-23),(1,-29)],
    [(0,0),(0,-8),(6,-13),(-2,-20),(5,-27)],
    [(0,0),(0,-10),(8,-10),(8,-20),(-1,-20),(-1,-29)],
    [(0,0),(0,-8),(-8,-8),(-8,-18),(4,-18),(4,-30)],
    [(0,0),(0,-9),(7,-14),(7,-24),(-5,-24),(-5,-32),(2,-36)],
    [(0,0),(0,-10),(-8,-10),(-8,-20),(5,-20),(5,-31),(-2,-37)],
    [(0,0),(0,-11),(9,-11),(9,-22),(-6,-22),(-6,-34),(5,-40),(5,-47)],
]

def transform(p=(0,0,0), scale=(1,1,1), yaw=0):
    return dict(position=list(p), scale=list(scale), rotation=[0,math.sin(yaw/2),0,math.cos(yaw/2)])

def entity(kind, name, p=(0,0,0), scale=(1,1,1), **kw):
    return dict(parent_idx=-1,name=name,type=kind,transform=transform(p,scale),**kw)

def distance(a,b): return math.dist(a,b)
def lerp(a,b,t): return tuple(x+(y-x)*t for x,y in zip(a,b))
def canonical(value):
    # libm differs in its last bits between Windows and Linux. Persist only
    # micrometre precision and normalize signed zero in generated JSON.
    if isinstance(value,float):
        rounded=round(value,6)
        return 0.0 if rounded==0 else rounded
    if isinstance(value,(list,tuple)):return [canonical(v)for v in value]
    if isinstance(value,dict):return {k:canonical(v)for k,v in value.items()}
    return value

def smooth_route(points):
    """Fillet each bend; every generated strip has an unbroken walkable center."""
    out=[points[0]]
    for i in range(1,len(points)-1):
        a,p,b=points[i-1:i+2]
        incoming=tuple((p[k]-a[k])/distance(a,p)for k in range(2));outgoing=tuple((b[k]-p[k])/distance(p,b)for k in range(2))
        angle=math.acos(max(-1,min(1,sum(x*y for x,y in zip(incoming,outgoing)))))
        if angle<.001:continue
        tangent=min(3.4*math.tan(angle/2),distance(a,p)*.45,distance(p,b)*.45)
        radius=tangent/math.tan(angle/2)
        before=lerp(p,a,tangent/distance(a,p));after=lerp(p,b,tangent/distance(p,b))
        n=max(1,math.ceil(distance(out[-1],before)/1.2))
        segment_start=out[-1]
        out.extend(lerp(segment_start,before,j/n) for j in range(1,n+1))
        sign=1 if incoming[0]*outgoing[1]-incoming[1]*outgoing[0]>0 else -1
        center=(before[0]-sign*incoming[1]*radius,before[1]+sign*incoming[0]*radius)
        initial=math.atan2(before[1]-center[1],before[0]-center[0]);steps=max(4,math.ceil(angle*radius/.4))
        for j in range(1,steps+1):
            theta=initial+sign*angle*j/steps;out.append((center[0]+radius*math.cos(theta),center[1]+radius*math.sin(theta)))
    start=out[-1];n=max(1,math.ceil(distance(start,points[-1])/1.2))
    out.extend(lerp(start,points[-1],j/n) for j in range(1,n+1))
    return out

class Mesh:
    def __init__(self): self.points=[];self.faces=[]
    def face(self, points, material='ground', water=(0,0,0)):
        start=len(self.points)//3
        self.points.extend(round(v,5) for p in points for v in p)
        self.faces.append(dict(material_name=material,idxs=list(range(start,start+len(points))),uvs=[0,0]*len(points),uv_gen_type='ground' if material=='ground' else 'wall-side',water_dir=list(water)))
    def box(self,lo,hi,material='wall'):
        x,y,z=lo;X,Y,Z=hi
        p=[(x,y,z),(X,y,z),(X,Y,z),(x,Y,z),(x,y,Z),(X,y,Z),(X,Y,Z),(x,Y,Z)]
        for indices in [(3,7,6,2),(0,1,5,4),(0,4,7,3),(1,2,6,5),(0,3,2,1),(4,5,6,7)]:self.face([p[i]for i in indices],material)
    def finish(self,name,kind='geo',movement=None):
        triangles=sum((len(f['idxs'])-2)*3 for f in self.faces)
        # JSON float arrays use signed fixed point with precision 100000.
        uvs=base64.b64encode(struct.pack('<ii',50000,50000)*triangles).decode()
        return entity(kind,name,geo=dict(p=self.points,faces=self.faces),lightmap_section=dict(lightmap_name='campaign',uvs=uvs),movement=movement or dict(type='none'))

def strip(mesh,path,width,material='ground',walls=True,openings=()):
    sides=[]
    for i,p in enumerate(path):
        a=path[max(0,i-1)];b=path[min(len(path)-1,i+1)]
        dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz)
        nx,nz=-dz/length,dx/length
        sides.append(((p[0]+nx*width/2,p[1],p[2]+nz*width/2),(p[0]-nx*width/2,p[1],p[2]-nz*width/2)))
    for i in range(len(path)-1):
        l,r=sides[i];L,R=sides[i+1];mesh.face([l,L,R,r],material)
        if walls and all(distance(path[i],p)>3.5 for p in openings):
            for a,b in [(l,L),(R,r)]:
                A=(a[0],a[1]+.42,a[2]);B=(b[0],b[1]+.42,b[2])
                mesh.face([a,A,B,b],'wall')
                mesh.face([A,(A[0]+.08,A[1],A[2]),(B[0]+.08,B[1],B[2]),B],'rim')
    # End caps keep a poor first/last shot in play.
    for l,r in [sides[0],tuple(reversed(sides[-1]))]:
        mesh.face([l,r,(r[0],r[1]+.42,r[2]),(l[0],l[1]+.42,l[2])],'wall')

def loop_mesh(origin, radius=1.25):
    """A true vertical helical loop; a surrounding green offers a slower bypass."""
    mesh=Mesh();x,y,z=origin;path=[]
    for i in range(81):
        t=i/80;theta=2*math.pi*t
        path.append((x+2.2*t,y+radius*(1-math.cos(theta)),z-radius*math.sin(theta)))
    # Width follows the transverse x axis, giving the loop an inward-facing ribbon.
    for a,b in zip(path,path[1:]):
        mesh.face([(a[0]-.65,a[1],a[2]),(a[0]+.65,a[1],a[2]),(b[0]+.65,b[1],b[2]),(b[0]-.65,b[1],b[2])],'loop')
    return mesh.finish('vertical-loop')

def make_course(world,stage):
    number=world*10+stage+1
    scale=1+world*.025
    waypoints=[(x*scale*(1+.015*world),z*scale)for x,z in ROUTES[stage]]
    # Even introductory stages have genuinely different bends in each world.
    for i in range(2,len(waypoints)):
        x,z=waypoints[i];waypoints[i]=(x+math.sin(world*.8+i)*world*.24,z-world*.16*i)
    if world==2:
        radius=3.8+stage*.13;turn=math.pi*(.62+stage*.035)
        waypoints=[(0,0),(0,-8)]+[(radius-radius*math.cos(turn*i/18),-8-radius*math.sin(turn*i/18))for i in range(1,19)]
        x,z=waypoints[-1];exit=(x+6*math.sin(turn),z-6*math.cos(turn));waypoints.extend([exit,(exit[0]-(7+stage*.3)*math.cos(turn),exit[1]-(7+stage*.3)*math.sin(turn))])
    points=smooth_route(waypoints);lengths=[0]
    for a,b in zip(points,points[1:]):lengths.append(lengths[-1]+distance(a,b))
    path=[]
    for (x,z),s in zip(points,lengths):
        height=0
        if world in [3,4,5,6,7,8,9] and 5<s<lengths[-1]-4:
            # Long approach, rounded crest, steeper landing: speed decides air time.
            u=(s-5)/(lengths[-1]-9);height=(.55+.055*world+.035*stage)*math.sin(math.pi*u)**2
            if world in [3,6,8,9]:height*=1+.25*math.sin((2+stage//4)*2*math.pi*u)
        path.append((x,height,z))
    width=max(2.35,4.9-world*.16-stage*.065)
    loop_entry=next(p for p,s in zip(path,lengths)if s>=3.5)
    mesh=Mesh();strip(mesh,path,width,openings=[loop_entry] if world in [2,5,7,8,9] else [])
    start=(path[0][0],path[0][1],path[0][2]-1.5)
    hole=(path[-1][0],path[-1][1],path[-1][2]+1.5)
    entities=[entity('ball-start','ball-start',start,(.25,.25,.25)),entity('hole','hole',hole,(.4,.4,.4)),entity('group',f'campaign:{world+1}:{stage+1}:{number}'),mesh.finish('campaign-fairway')]
    # Existing camera zones face down each stretch instead of inheriting the
    # orientation of the previous course. Their bounds are axis aligned.
    for a,b in zip(path,path[1:]):
        yaw=-math.atan2(b[2]-a[2],b[0]-a[0])
        zone=entity('camera_zone','campaign-camera',tuple((x+y)/2 for x,y in zip(a,b)),(abs(b[0]-a[0])/2+width*.55,4,abs(b[2]-a[2])/2+width*.55),towards_hole=False)
        zone['transform']['rotation']=[0,math.sin(yaw/2),0,math.cos(yaw/2)]
        entities.append(zone)
    feature_names=[];bank_site=None
    # A lateral obstruction leaves a meaningful choice of bank angle and lane.
    if stage>=3:
        index=max(2,len(path)//3);p=path[index];a=path[index-1];b=path[index+1];d=(b[0]-a[0],b[2]-a[2]);n=math.hypot(*d);side=(-d[1]/n,d[0]/n)
        center=(p[0]+side[0]*width*.23,p[1],p[2]+side[1]*width*.23)
        bank_site=center
        block=Mesh();block.box((center[0]-.28,center[1],center[2]-.35),(center[0]+.28,center[1]+.52,center[2]+.35),'stone');entities.append(block.finish('bank-shot-stone'));feature_names.append('bank')
    # Water surrounds raised causeways; misses always have the existing recovery.
    if world in [1,3,6,8,9]:
        xs=[p[0]for p in path];zs=[p[2]for p in path];water=Mesh();water.face([(min(xs)-7,-.65,max(zs)+5),(max(xs)+7,-.65,max(zs)+5),(max(xs)+7,-.65,min(zs)-5),(min(xs)-7,-.65,min(zs)-5)],'hazard' if world==6 else 'water',(0,0,-.15))
        entities.append(water.finish('lava-basin' if world==6 else 'zen-lagoon','geo' if world==6 else 'water'));feature_names.append('lava' if world==6 else 'water')
    if world in [2,5,8,9]:
        # Place the loop on a connected broad green with room to approach and exit.
        p=(loop_entry[0]+width/2+1.9,0,loop_entry[2]);pad=Mesh();pad.box((p[0]-4,-.15,p[2]-2.2),(p[0]+4,0,p[2]+2.2),'ground');entities.append(pad.finish('loop-approach-green'))
        entities.append(loop_mesh((p[0]-1.1,p[1],p[2]),1.05+stage*.025));feature_names.append('loop')
    if world>=7:
        # An optional moving ferry links two side landings. The main lane stays
        # available, so missing its timing cannot permanently block a course.
        x=-width/2-1.1;z=loop_entry[2];landings=Mesh()
        for offset in [-1.9,1.9]:landings.box((x-1.2,-.16,z+offset-.65),(-width/2+.15,0,z+offset+.65),'ground')
        entities.append(landings.finish('ferry-landings'))
        ferry=Mesh();ferry.box((-.9,-.14,-.65),(.9,0,.65),'stone')
        bridge=ferry.finish('moving-ferry',movement=dict(type='linear',t0=stage*.27,length=4.6-stage*.08,p0=[0,0,-1.25],p1=[0,0,1.25]));bridge['transform']=transform((x,0,z));entities.append(bridge)
        feature_names.append('moving-platform')
    if world in [2,5,7,8,9]:
        idx=max(4,len(path)//4);p=path[idx];q=path[min(idx+3,len(path)-1)];roof=Mesh();roof.box((p[0]-width*.65,p[1]+1.8,p[2]-.6),(p[0]+width*.65,p[1]+2.05,p[2]+.6),'stone');entities.append(roof.finish('quiet-tunnel'));feature_names.append('tunnel')
    if world>=4:
        count=1+(world>=8 and stage>=6)
        for k in range(count):
            p=path[len(path)*(2+k)//5];direction=(-1 if (stage+k)%2 else 1)*(.7+stage*.05+world*.04)
            e=entity('group',f'wind:{direction:.3f}',p,(width*.55,1.4,1.9));entities.append(e)
        feature_names.append('wind')
    if world in [5,7,8,9]:
        for endpoint,fraction in enumerate([.24,.72]):
            p=path[int((len(path)-1)*fraction)];entities.append(entity('group',f'portal:0:{endpoint}',p,(.55,1,.55)))
        feature_names.append('portal')
    if world>=4 and stage>=3:
        p=path[len(path)*3//5];gate=Mesh();gate.box((-.23,0,-.23),(.23,.65,.23),'stone');e=gate.finish('timed-gate',movement=dict(type='linear',t0=stage*.31,length=max(3.4,6-world*.15-stage*.08),p0=[-width*.24,0,0],p1=[width*.24,0,0]));e['transform']=transform(p);entities.append(e);feature_names.append('moving')
    if world>=7:
        # Staggered baffles leave alternating gaps rather than a blocked corridor.
        for k in range(1,2+stage//3):
            p=path[min(len(path)-3,len(path)*(k+1)//(4+stage//3))]
            if bank_site and distance(p,bank_site)<2.0:continue
            baffle=Mesh();offset=(-1 if k%2 else 1)*width*.23
            baffle.box((p[0]+offset-.35,p[1],p[2]-.18),(p[0]+offset+.35,p[1]+.48,p[2]+.18),'stone');entities.append(baffle.finish(f'labyrinth-baffle-{k}'))
        feature_names.append('maze')
    if world>=3:feature_names.append('ramp')
    animals=[]
    if world>=1:
        animals.append('romeu')
        if world>=3 and stage>=2:animals.append('luna')
        if world>=5 and stage>=4:animals.append('frida')
    for kind,name in enumerate(['romeu','luna','frida']):
        if name in animals:entities.append(entity('group',f'animal:{kind}',path[int((len(path)-1)*(.3+kind*.19))],(.55,.55,.55)))
    flag=entity('model','flag',hole,(2,2,2),model='data/models/flag_red.obj',uv_scale=1,ignore_physics=True,movement=dict(type='none'),lightmap_section=dict(lightmap_name='campaign',uvs=''))
    # Flag is replaced by the existing garden renderer, but valid UVs keep loading safe.
    vertices=sum(3*(len(line.split())-3)for line in (ROOT/'data/models/flag_red.obj').read_text().splitlines()if line.startswith('f '))
    flag['lightmap_section']['uvs']=base64.b64encode(struct.pack('<ii',50000,50000)*vertices).decode();entities.append(flag)
    entities.append(entity('begin_animation','begin_animation',(start[0]+7,9,start[2]+5)))
    palette=WORLDS[world][4];rgb=[int(palette[i:i+2],16)/255 for i in [1,3,5]]
    colors={'ground':rgb,'wall':[.56,.40,.26],'rim':[.79,.64,.39],'stone':[.57,.57,.53],'loop':[.65,.73,.76],'water':[.42,.72,.76],'hazard':[.82,.29,.13],'metal':[.7,.65,.5],'border':[.85,.3,.2]}
    materials=[dict(name=name,type='diffuse_color',color=color+[1],friction=.02 if name=='loop' else .3,restitution=.35 if name in ['wall','stone'] else .15,vel_scale=0 if name=='hazard' else .97 if name=='rim' else 1)for name,color in colors.items()]
    # The established in-game renderer draws environment materials. Keep the
    # palette separately for scenery; diffuse-only faces belong to the editor.
    materials.append(dict(name='biome-palette',type='diffuse_color',color=rgb+[1],friction=.3,restitution=.15,vel_scale=1))
    ground_texture=['ground.png']*10
    ground_texture[6]='colors/dark_gray.png';ground_texture[7]='colors/dark_gray.png'
    textures={'ground':ground_texture[world],'wall':'wood.jpg','rim':'wood.jpg','stone':'colors/light_gray.png','loop':'colors/light_gray.png','water':'colors/blue.png','hazard':'colors/red.png','metal':'colors/light_gray.png','border':'colors/red.png'}
    for material in materials:
        if material['name'] in textures:
            material['type']='environment';material['texture']='data/textures/'+textures[material['name']]
    light=base64.b64encode((ROOT/'data/textures/colors/white.png').read_bytes()).decode()
    level=dict(data_dependencies=[],materials=materials,lightmap_images=[dict(name='campaign',resolution=1,time_length=0,repeats=False,datas=[light])],entities=entities)
    record=dict(number=number,world=world+1,stage=stage+1,path=f'data/campaign/course-{number:03d}.level',width=round(width,3),length=round(lengths[-1],3),features=feature_names,animals=animals,route=[[round(v,4)for v in p]for p in path],spawn=start,hole=hole,difficulty=number,geometryHash=hashlib.sha256(json.dumps([e.get('geo')for e in entities if 'geo'in e],sort_keys=True).encode()).hexdigest())
    level=canonical(level);record=canonical(record)
    record['geometryHash']=hashlib.sha256(json.dumps([e.get('geo')for e in level['entities']if 'geo'in e],sort_keys=True).encode()).hexdigest()
    return level,record

def generate(check=False):
    target=ROOT/'data/campaign';target.mkdir(exist_ok=True)
    records=[]
    for world in range(10):
        for stage in range(10):
            level,record=make_course(world,stage);records.append(record);p=ROOT/record['path'];text=json.dumps(level,separators=(',',':'))+'\n'
            if check:
                if not p.exists()or p.read_text()!=text:raise SystemExit(f'Campaign mesh is stale: {p}')
            else:p.write_text(text)
    manifest=dict(version=1,worlds=[dict(id=i+1,key=w[0],names={'pt-BR':w[1],'en':w[2],'es':w[3]},color=w[4],first=i*10+1,last=i*10+10)for i,w in enumerate(WORLDS)],courses=records)
    text=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n';p=target/'manifest.json'
    if check:
        if p.read_text(encoding='utf-8')!=text:raise SystemExit('Campaign manifest is stale')
    else:p.write_text(text,encoding='utf-8')
    browser=dict(version=1,worlds=manifest['worlds'],courses=[{k:r[k]for k in ['number','world','stage','animals','features']}for r in records])
    p=ROOT/'build/emscripten/campaign-data.js';text='window.GOLF_CAMPAIGN='+json.dumps(browser,ensure_ascii=False,separators=(',',':'))+';\n'
    if check:
        if not p.exists()or p.read_text(encoding='utf-8')!=text:raise SystemExit('Browser campaign catalogue is stale')
    else:p.write_text(text,encoding='utf-8')
    assert len({r['geometryHash']for r in records})==100
    print('100 distinct course meshes; 10 worlds; deterministic manifest verified.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');generate(parser.parse_args().check)
