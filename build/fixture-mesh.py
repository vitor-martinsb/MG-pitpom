"""Geometry helpers for physical test fixtures, not the playable catalogue."""
import math,base64,struct
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
