"""One isolated, flat practice course; never add it to the campaign catalogue."""
import argparse, base64, importlib.util, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mesh',Path(__file__).with_name('evolution-mesh.py'))
mesh=importlib.util.module_from_spec(spec);spec.loader.exec_module(mesh)
def course():
    def entity(kind,name,p,scale=(1,1,1)):
        t=mesh.identity();t['position']=list(p);t['scale']=list(scale)
        return dict(parent_idx=-1,name=name,type=kind,transform=t)
    def quad(points,mat):return mesh.face(points,mat)
    def box(name,x0,x1,z0,z1):
        a,b,c,d=(x0,0,z0),(x0,0,z1),(x1,0,z1),(x1,0,z0)
        up=lambda p:(p[0],.42,p[2])
        faces=[quad([up(a),up(b),up(c),up(d)],'wall-top')]
        for p,q in [(a,b),(b,c),(c,d),(d,a)]:faces.append(quad([p,q,up(q),up(p)],'wall-side'))
        return mesh.geo_entity(name,faces)
    green=[];rim=[];hole=(0,-2.5);radius=.24
    angles=sorted(set([i*2*math.pi/32 for i in range(32)]+[math.atan2(z-hole[1],x)%(2*math.pi) for x,z in [(-1.8,-4),(1.8,-4),(1.8,4),(-1.8,4)]]))
    for i in range(len(angles)):
        points=[]
        for j in [i,i+1]:
            a=angles[j] if j<len(angles) else angles[0]+2*math.pi;dx,dz=math.cos(a),math.sin(a)
            limits=[]
            if abs(dx)>1e-8:limits.append(1.8/abs(dx))
            if abs(dz)>1e-8:limits.append(((4-hole[1]) if dz>0 else (hole[1]+4))/abs(dz))
            t=min(limits);points.append(((round(dx*t,6),0,round(hole[1]+dz*t,6)),(round(dx*radius,6),0,round(hole[1]+dz*radius,6))))
        (a,b),(c,d)=points
        green.append(quad([a,b,d,c],'ground'))
        rim.append(quad([b,(b[0],-.35,b[2]),(d[0],-.35,d[2]),d],'wall-side'))
    bottom=[(round(math.cos(a)*radius,6),-.35,round(hole[1]+math.sin(a)*radius,6))for a in reversed(angles)]
    rim.append(quad(bottom,'ground'))
    start=entity('ball-start','tutorial-tee',(0,0,2.5),(.25,.25,.25))
    cup=entity('hole','tutorial-hole',(0,0,-2.5),(.4,.4,.4))
    flag=entity('model','tutorial-flag',(0,0,-2.5),(2,2,2));flag.update(model='data/models/flag_red.obj',uv_scale=1,ignore_physics=True,movement={'type':'none'})
    zone=entity('camera_zone','tutorial-camera',(0,0,0),(3,.05,5));zone['towards_hole']=True
    return dict(data_dependencies=['data/textures/hole_lightmap.png','data/textures/ground.png','data/textures/wood.jpg','data/models/flag_red.obj'],
      materials=[dict(name=name,friction=.3 if name!='wall-side' else 0,restitution=.4 if name!='wall-side' else .8,vel_scale=1,type='environment',texture='data/textures/ground.png'if name=='ground'else'data/textures/wood.jpg')for name in ['ground','wall-side','wall-top']],
      lightmap_images=[dict(name='evolution',resolution=1,time_length=0,repeats=False,datas=[base64.b64encode((ROOT/'data/textures/colors/white.png').read_bytes()).decode()])],
      entities=[start,cup,flag,zone,entity('begin_animation','tutorial-menu-camera',(5,6,8)),mesh.geo_entity('tutorial-green',green),mesh.geo_entity('tutorial-cup',rim),box('tutorial-left',-1.95,-1.8,-4.15,4.15),box('tutorial-right',1.8,1.95,-4.15,4.15),box('tutorial-far',-1.8,1.8,-4.15,-4),box('tutorial-near',-1.8,1.8,4,4.15)])
if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('--check',action='store_true');options=args.parse_args()
    path=ROOT/'data/tutorial/practice.level';text=json.dumps(course(),ensure_ascii=False,separators=(',',':'))+'\n'
    if options.check:
        if not path.exists() or path.read_text()!=text:raise SystemExit('Tutorial course is stale')
    else:path.parent.mkdir(exist_ok=True);path.write_text(text)
    print('Isolated tutorial: flat green, real cup, four static borders; no animals or campaign entry.')
