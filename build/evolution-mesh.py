"""Deterministic edits of existing course geometry; no random course generator."""
import base64, copy, math, struct

def rotate(p,q):
    x,y,z,w=q; a,b,c=p
    t=(2*(y*c-z*b),2*(z*a-x*c),2*(x*b-y*a))
    return (a+w*t[0]+y*t[2]-z*t[1],b+w*t[1]+z*t[0]-x*t[2],c+w*t[2]+x*t[1]-y*t[0])

def world(level,index,p,inverse=False):
    e=level['entities'][index];t=e['transform'];parent=e['parent_idx']
    if inverse:
        if parent>=0:p=world(level,parent,p,True)
        p=tuple(p[k]-t['position'][k] for k in range(3));q=t['rotation']
        p=rotate(p,[-q[0],-q[1],-q[2],q[3]])
        return tuple(p[k]/t['scale'][k] for k in range(3))
    p=rotate(tuple(p[k]*t['scale'][k]for k in range(3)),t['rotation'])
    p=tuple(p[k]+t['position'][k]for k in range(3))
    return world(level,parent,p)if parent>=0 else p

def clip(poly,axis,value,positive):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=(a[axis]-value)*(1 if positive else -1);db=(b[axis]-value)*(1 if positive else -1)
        if da>=-1e-8:result.append(a)
        if (da>1e-8 and db<-1e-8)or(da<-1e-8 and db>1e-8):
            t=da/(da-db);result.append(tuple(a[k]+(b[k]-a[k])*t for k in range(len(a))))
    return result

def normal(p):
    a=[p[1][k]-p[0][k]for k in range(3)];b=[p[2][k]-p[0][k]for k in range(3)]
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])

def polygons(level,index):
    geo=level['entities'][index]['geo'];p=geo['p']
    pts=[world(level,index,p[k:k+3])for k in range(0,len(p),3)]
    result=[]
    for f in geo['faces']:
        poly=[pts[k]for k in f['idxs']]
        if level['entities'][index]['type']=='water'and f.get('uv_gen_type')=='manual'and len(f['uvs'])==len(poly)*2:
            poly=[(*p,*f['uvs'][i*2:i*2+2])for i,p in enumerate(poly)]
        result.append((copy.deepcopy(f),poly))
    return result

def store(level,index,faces):
    entity=level['entities'][index];points=[];out=[];lookup={}
    for face,poly in faces:
        # Repeated clipping introduces duplicate / collinear edge points.
        # They must not make a valid floor polygon look like a zero-area face.
        poly=list(poly)
        changed=True
        while changed and len(poly)>=3:
            changed=False
            for i in range(len(poly)):
                a,b,c=poly[i-1],poly[i],poly[(i+1)%len(poly)]
                u=[b[k]-a[k] for k in range(3)];v=[c[k]-b[k] for k in range(3)]
                cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
                if sum(q*q for q in cross)<1e-16 and sum(u[k]*v[k] for k in range(3))>=-1e-10:
                    poly.pop(i);changed=True;break
        if len(poly)<3:continue
        n=normal(poly)
        if sum(v*v for v in n)<1e-14:continue
        ids=[]
        for p in poly:
            p=tuple(round(v,6)for v in world(level,index,p[:3],True))
            if p not in lookup:lookup[p]=len(points)//3;points.extend(p)
            ids.append(lookup[p])
        face['idxs']=ids
        if entity['type']=='water':
            if all(len(p)>=5 for p in poly):face['uvs']=[round(v,6)for p in poly for v in (min(1,max(0,p[3])),p[4])]
            face['uv_gen_type']='manual'
        else:face['uvs']=[round(v,6)for p in poly for v in (p[0]*.25,p[2]*.25)]
        out.append(face)
    entity['geo']={'p':points,'faces':out}
    vertices=sum((len(f['idxs'])-2)*3 for f in out)
    entity['lightmap_section']={'lightmap_name':'evolution','uvs':base64.b64encode(struct.pack('<ii',50000,50000)*vertices).decode()}

def warp(level,axis,center,radius,cross,shift=0,narrow=0,pivot=0,indices=None):
    """Bend/narrow a specific corridor, inserting shared boundary vertices first."""
    def deform(p):
        p=list(p);u=abs(p[axis]-center)/radius;weight=(.5+.5*math.cos(math.pi*u))if u<1 else 0
        p[cross]=pivot+(p[cross]-pivot)*(1-narrow*weight)+shift*weight
        return tuple(p)
    for index,e in enumerate(level['entities']):
        if 'geo'not in e or e.get('movement',{}).get('type','none')!='none':continue
        if indices is not None and index not in indices:continue
        faces=[]
        for face,poly in polygons(level,index):
            pieces=[poly]
            for plane in [center-radius,center-radius*.5,center,center+radius*.5,center+radius]:
                split=[]
                for piece in pieces:
                    if min(p[axis]for p in piece)<plane-1e-6 and max(p[axis]for p in piece)>plane+1e-6:
                        split.extend([clip(piece,axis,plane,True),clip(piece,axis,plane,False)])
                    else:split.append(piece)
                pieces=split
            for piece in pieces:
                changed=[]
                for p in piece:
                    changed.append(deform(p))
                faces.append((copy.deepcopy(face),changed))
        store(level,index,faces)
    # Keep the visual bed and banks on the same subdivided curve as the water.
    # These markers have no collision geometry and never affect the originals.
    for index,e in list(enumerate(level['entities'])):
        if e['type']!='group'or e['name']!='evolution-river-bank':continue
        t=e['transform'];length=t['scale'][2];width=t['scale'][0]
        a=tuple(t['position'][k]+rotate((0,0,-length*.5),t['rotation'])[k]for k in range(3))
        b=tuple(t['position'][k]+rotate((0,0,length*.5),t['rotation'])[k]for k in range(3))
        if max(a[axis],b[axis])<=center-radius or min(a[axis],b[axis])>=center+radius:continue
        cuts=[0,1]
        if abs(b[axis]-a[axis])>1e-8:
            for plane in [center-radius,center-radius*.5,center,center+radius*.5,center+radius]:
                cut=(plane-a[axis])/(b[axis]-a[axis])
                if 1e-8<cut<1-1e-8:cuts.append(cut)
        cuts=sorted(cuts)
        for part,(start,end)in enumerate(zip(cuts,cuts[1:])):
            original_mid=tuple(a[k]+(b[k]-a[k])*(start+end)*.5 for k in range(3))
            A=deform(tuple(a[k]+(b[k]-a[k])*start for k in range(3)));B=deform(tuple(a[k]+(b[k]-a[k])*end for k in range(3)))
            side=rotate((width*.5,0,0),t['rotation'])
            left=deform(tuple(original_mid[k]-side[k]for k in range(3)));right=deform(tuple(original_mid[k]+side[k]for k in range(3)))
            bank=group('evolution-river-bank',tuple((A[k]+B[k])*.5 for k in range(3)))
            angle=math.atan2(B[0]-A[0],B[2]-A[2]);bank['transform']['rotation']=[0,math.sin(angle*.5),0,math.cos(angle*.5)]
            bank['transform']['scale']=[math.hypot(right[0]-left[0],right[2]-left[2]),1,math.hypot(B[0]-A[0],B[2]-A[2])]
            if part==0:level['entities'][index]=bank
            else:level['entities'].append(bank)

def floor_at(level,x,z,hint):
    best=None
    for i,e in enumerate(level['entities']):
        if e['type']!='geo'or e.get('movement',{}).get('type','none')!='none':continue
        for _,poly in polygons(level,i):
            for j in range(1,len(poly)-1):
                a,b,c=poly[0],poly[j],poly[j+1];n=normal([a,b,c])
                if n[1]<.35*math.sqrt(sum(v*v for v in n)):continue
                d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
                if abs(d)<1e-10:continue
                u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d
                v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d
                if min(u,v,1-u-v)<-1e-6:continue
                y=u*a[1]+v*b[1]+(1-u-v)*c[1]
                if abs(y-hint)<.35 and(best is None or abs(y-hint)<abs(best-hint)):best=y
    return best

def bend(level,axis,center,radius,shift):
    """A coherent shear of the playable mesh, banks and moving assemblies.

    Motion sweeps get flat offset plateaus: their rigid collision geometry and
    surrounding floor move together, without bending a pendulum or its pivot.
    The cross-axis shear is invertible and leaves height/launch slopes intact.
    """
    cross=2 if axis==0 else 0
    bands=[]
    for i,e in enumerate(level['entities']):
        if 'geo' not in e or e.get('movement',{}).get('type','none')=='none':continue
        points=[p for _,poly in polygons(level,i) for p in poly]
        pivot=world(level,i,(0,0,0));movement=e['movement']
        lo=min(p[axis] for p in points);hi=max(p[axis] for p in points)
        if movement['type']=='linear':
            a=movement.get('p0',[0,0,0])[axis];b=movement.get('p1',[0,0,0])[axis]
            lo+=min(a,b);hi+=max(a,b)
        elif movement['type'] in ['spinner','pendulum']:
            extent=max(math.hypot(p[0]-pivot[0],p[2]-pivot[2]) for p in points)
            lo=min(lo,pivot[axis]-extent);hi=max(hi,pivot[axis]+extent)
        if hi>center-radius and lo<center+radius:bands.append((lo-.2,hi+.2))
    merged=[]
    for a,b in sorted(bands):
        if merged and a<merged[-1][1]+.3:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
        else:merged.append((a,b))
    def base(x):
        u=abs(x-center)/radius
        return shift*(.5+.5*math.cos(math.pi*u)) if u<1 else 0
    def offset(x):
        value=base(x)
        for a,b in merged:
            # Smooth shoulder outside each rigid moving assembly.
            distance=max(a-x,0,x-b);blend=max(0,1-distance/.65)
            blend=blend*blend*(3-2*blend)
            value=value*(1-blend)+base((a+b)*.5)*blend
        return value
    def deform(p):
        q=list(p);q[cross]+=offset(p[axis]);return tuple(q)
    planes=[center-radius+i*radius/4 for i in range(9)]
    planes+= [v for a,b in merged for v in (a-.65,a,b,b+.65)]
    planes=sorted(set(planes))
    for index,e in list(enumerate(level['entities'])):
        if 'geo' in e:
            if e.get('movement',{}).get('type','none')!='none':
                pivot=world(level,index,(0,0,0));amount=offset(pivot[axis])
                # Original moving objects have unrotated root/translation parents.
                parent=e['parent_idx'];origin=e['transform']['position']
                q=deform(pivot)
                local=world(level,parent,q,True) if parent>=0 else q
                e['transform']['position']=list(local)
                continue
            faces=[]
            for face,poly in polygons(level,index):
                pieces=[poly]
                for plane in planes:
                    pieces=[part for piece in pieces for part in
                        ([clip(piece,axis,plane,True),clip(piece,axis,plane,False)]
                        if min(p[axis] for p in piece)<plane-1e-6 and max(p[axis] for p in piece)>plane+1e-6 else [piece])]
                for piece in pieces:
                    f=copy.deepcopy(face)
                    if e['type']=='water':
                        # Carry the current through the same local shear as its
                        # channel. A stale straight direction pushes into banks.
                        p=tuple(sum(v[k] for v in piece)/len(piece) for k in range(3))
                        direction=face.get('water_dir',[0,0,0])
                        a=deform(p);b=deform(tuple(p[k]+direction[k]*.01 for k in range(3)))
                        f['water_dir']=[(b[k]-a[k])*100 for k in range(3)]
                    faces.append((f,[deform(p) for p in piece]))
            store(level,index,faces)
        elif e['type']=='group' and e['name']=='evolution-river-bank':
            # Short bank segments follow the same local tangent as their water.
            t=e['transform'];length=t['scale'][2]
            a=tuple(t['position'][k]+rotate((0,0,-length*.5),t['rotation'])[k] for k in range(3))
            b=tuple(t['position'][k]+rotate((0,0,length*.5),t['rotation'])[k] for k in range(3))
            cuts=[0,1]
            if abs(b[axis]-a[axis])>1e-8:
                cuts+= [(v-a[axis])/(b[axis]-a[axis]) for v in planes if 0<(v-a[axis])/(b[axis]-a[axis])<1]
            cuts=sorted(set(cuts))
            for part,(u,v) in enumerate(zip(cuts,cuts[1:])):
                A=deform(tuple(a[k]+(b[k]-a[k])*u for k in range(3)));B=deform(tuple(a[k]+(b[k]-a[k])*v for k in range(3)))
                bank=copy.deepcopy(e);bank['transform']['position']=[(A[k]+B[k])*.5 for k in range(3)]
                angle=math.atan2(B[0]-A[0],B[2]-A[2]);bank['transform']['rotation']=[0,math.sin(angle*.5),0,math.cos(angle*.5)]
                bank['transform']['scale'][2]=math.hypot(B[0]-A[0],B[2]-A[2])
                if part==0:level['entities'][index]=bank
                else:level['entities'].append(bank)
        elif e['type']=='group' and e['name'].startswith(('mill:','stream-entry:','stream-outlet:')):
            e['transform']['position']=list(deform(e['transform']['position']))
    return deform

def identity():return dict(position=[0,0,0],scale=[1,1,1],rotation=[0,0,0,1])
def group(name,p=(0,0,0)):
    t=identity();t['position']=list(p);return dict(parent_idx=-1,name=name,type='group',transform=t)

def geo_entity(name,faces,kind='geo'):
    e=dict(parent_idx=-1,name=name,type=kind,transform=identity(),geo={'p':[],'faces':[]},movement={'type':'none'})
    temporary={'entities':[e]};store(temporary,0,faces);return e

def face(poly,material='evolution-rock',water=(0,0,0)):
    n=normal(poly);horizontal=abs(n[1])>abs(n[0])+abs(n[2])
    return (dict(material_name=material,idxs=[],uvs=[],uv_gen_type='ground'if horizontal else'wall-side',water_dir=list(water)),poly)

def rock(level,name,x,z,hint,rx,rz,height,yaw=0):
    y=floor_at(level,x,z,hint)
    if y is None:raise ValueError(f'{name}: no authored floor at {x},{z},{hint}')
    points=[]
    for ring in range(2):
        for k in range(7):
            angle=2*math.pi*k/7+yaw;r=[1,.86,1.08,.91,1.03,.88,.97][k]*(.65 if ring else 1)
            points.append((x+math.cos(angle)*rx*r,y+(height*(.90+(k%3)*.05)if ring else 0),z+math.sin(angle)*rz*r))
    faces=[]
    for k in range(7):faces.append(face([points[k],points[k+7],points[(k+1)%7+7],points[(k+1)%7]]))
    faces.append(face(list(reversed(points[7:]))));faces.append(face(points[:7]))
    # Ensure a walkable top normal and closed hull, identical for render/physics.
    if normal(faces[-2][1])[1]<0:faces[-2]=(faces[-2][0],list(reversed(faces[-2][1])))
    level['entities'].append(geo_entity(name,faces))

def deck(level,x,z,y,width,length):
    """A low arched wooden crossing with collision ramps at both ends."""
    # The scenery's "wood" material has vel_scale=0 and stops a ball on
    # contact. Keep its texture, but give the playable deck ground physics.
    material='evolution-bridge-surface'
    if not any(m['name']==material for m in level['materials']):
        surface=copy.deepcopy(next(m for m in level['materials'] if m['name']=='ground'))
        surface.update(name=material,texture=next(m['texture'] for m in level['materials'] if m['name']=='wood'))
        level['materials'].append(surface)
    sections=[(-length/2,y+.015),(-length*.3,y+.14),(length*.3,y+.14),(length/2,y+.015)]
    faces=[]
    for (a,ha),(b,hb) in zip(sections,sections[1:]):
        faces.append(face([(x-width/2,ha,z+a),(x-width/2,hb,z+b),(x+width/2,hb,z+b),(x+width/2,ha,z+a)],material))
        for side in [-1,1]:
            xx=x+side*width/2
            poly=[(xx,y-.12,z+a),(xx,ha,z+a),(xx,hb,z+b),(xx,y-.12,z+b)]
            faces.append(face(poly if side<0 else list(reversed(poly)),material))
    level['entities'].append(geo_entity('evolution-bridge',faces))

def subtract_strip(poly,quad):
    """Polygon minus a convex stream strip, keeping every outside piece."""
    inside=poly;outside=[]
    area=sum(a[0]*b[2]-b[0]*a[2]for a,b in zip(quad,quad[1:]+quad[:1]));sign=1 if area>0 else -1
    for a,b in zip(quad,quad[1:]+quad[:1]):
        kept=[];removed=[]
        for p,q in zip(inside,inside[1:]+inside[:1]):
            dp=sign*((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]));dq=sign*((b[0]-a[0])*(q[2]-a[2])-(b[2]-a[2])*(q[0]-a[0]))
            # Boundary vertices belong to both pieces. Giving them only to
            # the inside cuts holes in a floor when adjacent strips share an edge.
            if dp>=-1e-8:kept.append(p)
            if dp<=1e-8:removed.append(p)
            if (dp>1e-8 and dq<-1e-8)or(dp<-1e-8 and dq>1e-8):
                t=dp/(dp-dq);r=tuple(p[k]+(q[k]-p[k])*t for k in range(len(p)));kept.append(r);removed.append(r)
        if len(removed)>=3:outside.append(removed)
        inside=kept
        if len(inside)<3:break
    return outside

def stream(level,name,path,width,y):
    # Continuous ribbon, including shared mitered corners and shallow entry /
    # exit ramps. The water's visual surface alone cannot support a ball.
    distances=[0]
    for a,b in zip(path,path[1:]):distances.append(distances[-1]+math.dist(a,b))
    total=distances[-1];ramp=min(.5,total*.2)
    # Do not insert centimetre-long strips beside an existing path joint:
    # their mitered banks can cross and leave slivers of grass in the channel.
    cuts=sorted(set([*distances,*[d for d in [ramp,total-ramp] if min(abs(d-v) for v in distances)>.15]]))
    bank_top=y+(.12 if any(e['type']=='water' and not e['name'].startswith('evolution-stream-') for e in level['entities']) else .025)
    refined=[]
    for distance in cuts:
        i=next((i for i in range(len(distances)-1) if distance<=distances[i+1]+1e-8),len(distances)-2)
        t=(distance-distances[i])/(distances[i+1]-distances[i]);a,b=path[i:i+2]
        refined.append((a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))
    path=refined;edges=[]
    for i,p in enumerate(path):
        a,b=path[max(0,i-1)],path[min(len(path)-1,i+1)]
        if i==0 or i==len(path)-1:
            dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);nx,nz=-dz/length,dx/length;scale=width*.5
        else:
            A,B=path[i-1],path[i+1];u=(p[0]-A[0],p[1]-A[1]);v=(B[0]-p[0],B[1]-p[1]);lu,lv=math.hypot(*u),math.hypot(*v)
            nx,nz=-u[1]/lu-v[1]/lv,u[0]/lu+v[0]/lv;length=math.hypot(nx,nz);nx,nz=nx/length,nz/length
            scale=min(width,width*.5/max(.5,nx*(-v[1]/lv)+nz*(v[0]/lv)))
        edges.append(((p[0]+nx*scale,y,p[1]+nz*scale),(p[0]-nx*scale,y,p[1]-nz*scale)))
    strips=[[edges[i][0],edges[i+1][0],edges[i+1][1],edges[i][1]] for i in range(len(path)-1)]
    for index,e in enumerate(level['entities']):
        old_water=e['type']=='water' and not e['name'].startswith('evolution-stream-')
        if (e['type']!='geo' and not old_water)or e.get('movement',{}).get('type','none')!='none':continue
        faces=[]
        for f,poly in polygons(level,index):
            n=normal(poly)
            if (not old_water and not f['material_name'].startswith('ground'))or n[1]<.4*math.sqrt(sum(v*v for v in n))or max(abs(p[1]-(y+.025))for p in poly)>.2:
                faces.append((f,poly));continue
            pieces=[poly]
            for quad in strips:pieces=[part for piece in pieces for part in subtract_strip(piece,quad)]
            faces.extend((copy.deepcopy(f),p)for p in pieces)
        store(level,index,faces)
    water=[];travelled=0
    for segment,(quad,(a,b))in enumerate(zip(strips,zip(path,path[1:]))):
        # Water follows the shallow exit ramp, so the ball keeps receiving
        # current until it has climbed back onto the grass.
        heights=[y+.065*max(0,1-min(d,total-d)/ramp) for d in cuts[segment:segment+2]]
        quad=[(p[0],heights[1 if j in [1,2] else 0],p[2]) for j,p in enumerate(quad)]
        if normal(quad)[1]<0:quad.reverse()
        d=math.hypot(b[0]-a[0],b[1]-a[1]);dx,dz=(b[0]-a[0])/d,(b[1]-a[1])/d
        f=face(quad,'evolution-water',(dx,0,dz))[0];f['uv_gen_type']='manual'
        # The existing Campo 7 shader expects U across the stream in [0,1].
        # World-space grass UVs extrapolate its white edge foam over all water.
        f['uvs']=[v for p in quad for v in (min(1,max(0,((p[0]-a[0])*-dz+(p[2]-a[1])*dx)/width+.5)),-(travelled+(p[0]-a[0])*dx+(p[2]-a[1])*dz)/3)]
        water.append((f,quad));travelled+=d
    level['entities'].append(geo_entity(name,water,'water'))
    material='evolution-river-bed'
    if not any(m['name']==material for m in level['materials']):
        level['materials'].append(dict(name=material,friction=.015,restitution=.1,vel_scale=1,type='environment',texture='data/textures/environment/slab.jpg'))
    bed=[]
    for i,quad in enumerate(strips):
        # Stay above the original out-of-bounds plane below the fairway while
        # keeping the ball submerged enough to receive continuous current.
        heights=[y-.04+.065*max(0,1-min(d,total-d)/ramp) for d in cuts[i:i+2]]
        # quad order may have been reversed for water winding; use shared edges.
        A,B=edges[i],edges[i+1];ha,hb=heights
        floor=[(A[0][0],ha,A[0][2]),(B[0][0],hb,B[0][2]),(B[1][0],hb,B[1][2]),(A[1][0],ha,A[1][2])]
        if normal(floor)[1]<0:floor.reverse()
        bed.append(face(floor,material))
        for side in [0,1]:
            a,b=A[side],B[side]
            wall=[(a[0],ha,a[2]),(a[0],bank_top,a[2]),(b[0],bank_top,b[2]),(b[0],hb,b[2])]
            wall=list(dict.fromkeys(wall))
            # Face the inside of the channel.
            if side==1:wall.reverse()
            bed.append(face(wall,material))
    level['entities'].append(geo_entity('river-bed:'+name,bed))
    # Stable authority/test landmarks follow later terrain bends with the bed.
    entry=path[1]
    level['entities'].append(group('stream-entry:'+name,(entry[0],y,entry[1])))
    level['entities'].append(group('stream-outlet:'+name,(path[-1][0],y+.025,path[-1][1])))
    for a,b in zip(path,path[1:]):
        bank=group('evolution-river-bank',((a[0]+b[0])*.5,y,(a[1]+b[1])*.5))
        angle=math.atan2(b[0]-a[0],b[1]-a[1]);bank['transform']['rotation']=[0,math.sin(angle*.5),0,math.cos(angle*.5)]
        bank['transform']['scale']=[width,1,math.hypot(b[0]-a[0],b[1]-a[1])]
        level['entities'].append(bank)
