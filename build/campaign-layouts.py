"""Authored structural families and geometry-only similarity rejection.

No random runtime geometry. Seeds select reproducible edits to control points,
not recolorings. Width, branches and elevation are applied by the level writer.
"""
import math

NAMES=['grove','serpent','horseshoe','switchback','crescent','spiral','petals',
       'terraces','fork','archipelago','precision','canyon','courtyard','bridges',
       'meander','citadel','hairpin','delta','crater','constellation']
# World-specific authored sequences; category order deliberately varies.
ORDERS=[
 [0,1,7,10,2,8,14,16,6,12], [9,14,13,17,10,8,4,7,1,6],
 [4,5,10,6,3,7,14,15,16,19], [7,3,9,10,16,8,14,18,13,15],
 [13,1,19,14,7,17,10,16,8,5], [8,17,12,15,4,19,16,7,6,5],
 [18,16,11,7,9,8,14,10,17,15], [19,15,7,17,13,10,4,5,8,6],
 [3,6,9,11,16,8,7,18,14,19], [12,5,17,10,13,7,15,19,6,8]]

def layout(world,stage,attempt=0):
    kind=ORDERS[world][stage]
    key=world*137+stage*31+attempt*71
    def v(i):return .5+.5*math.sin(key*1.17+i*2.399963)
    w=5.8+world*.13+v(1)*2.8;l=9+stage*.38+v(2)*3
    if kind==0:points=[(0,0),(0,-l),(w,-l-5),(w+2,-l-12)]
    elif kind==1:points=[(0,0),(0,-7),(-w,-13),(-w,-20),(w*.8,-27),(w*.8,-34)]
    elif kind==2:points=[(0,0),(0,-l-8),(w+4,-l-8),(w+4,-3)]
    elif kind==3:points=[(0,0),(0,-8),(w+3,-8),(w+3,-17),(-w*.4,-17),(-w*.4,-27)]
    elif kind==4:
        radius=6+v(3)*2;turn=math.pi*(1.10+v(4)*.24)
        points=[(0,0),(0,-7)]+[(radius-radius*math.cos(turn*i/26),-7-radius*math.sin(turn*i/26))for i in range(1,27)]
        x,z=points[-1];points.append((x+3*math.sin(turn),z-3*math.cos(turn)))
    elif kind==5:
        turns=1.12+v(5)*.22
        points=[(5.5,2.5),(5.5,0)]
        for i in range(1,58):
            a=turns*2*math.pi*i/57;r=5.5+9.0*i/57
            points.append((r*math.cos(a),-r*math.sin(a)))
    elif kind==6:points=[(0,0),(0,-8),(-w,-12),(-w-3,-21),(0,-26),(w+4,-20),(w+4,-11),(w*.6,-8),(w*.6,-3)]
    elif kind==7:points=[(0,0),(0,-7),(w*.6,-13),(w*.6,-21),(-w*.5,-28),(-w*.5,-36)]
    elif kind==8:points=[(0,0),(0,-8),(-w,-13),(-w,-23),(0,-29),(w*.8,-23),(w*.8,-16)]
    elif kind==9:points=[(0,0),(0,-8),(w*.4,-16),(-w*.4,-24),(w*.7,-32)]
    elif kind==10:points=[(0,0),(0,-9),(w,-9),(w,-19),(-w*.7,-19),(-w*.7,-27)]
    elif kind==11:points=[(0,0),(0,-l*2.5),(w*.8,-l*3),(w*.8,-l*4.0)]
    elif kind==12:points=[(0,0),(0,-8),(-w,-13),(-w,-23),(0,-29),(w+2,-22),(w+2,-13),(w*.4,-10)]
    elif kind==13:points=[(0,0),(0,-8),(w,-14),(w,-22),(-w*.6,-28),(-w*.6,-34)]
    elif kind==14:points=[(0,0),(0,-7),(w,-11),(w*.4,-19),(-w,-23),(-w*.8,-31),(w*.4,-36)]
    elif kind==15:points=[(0,0),(0,-8),(-w,-8),(-w,-23),(w+2,-23),(w+2,-36),(-w*.4,-36),(-w*.4,-43)]
    elif kind==16:points=[(0,0),(0,-l-5),(w,-l-5),(w,-7),(w*2,-7),(w*2,-l-13)]
    elif kind==17:points=[(0,0),(0,-8),(-w,-16),(-w*.4,-25),(w+3,-30),(w+5,-19),(w*.4,-14)]
    elif kind==18:
        radius=6+v(6)*3;points=[(0,0),(0,-7)]+[(radius-radius*math.cos(i*math.pi*1.7/24),-7-radius*math.sin(i*math.pi*1.7/24))for i in range(1,25)]
        x,z=points[-1];points.append((x+3,z-6))
    else:points=[(0,0),(0,-8),(-w,-13),(-w*1.4,-25),(0,-32),(w*1.4,-23),(w*.7,-14),(w*.7,-4)]
    # Each course has its own bend proportions and a different start/goal bearing.
    stretch_x=.80+v(8)*.44;stretch_z=.82+v(9)*.40
    control=[]
    for i,(x,z)in enumerate(points):
        bend=0 if i<2 or kind in [4,5,18] else math.sin(key+i*1.7)*(.65+attempt*.10)
        control.append((x*stretch_x+bend,z*stretch_z))
    yaw=(world%4)*math.pi*.5+(stage-4)*.035
    control=[(x*math.cos(yaw)-z*math.sin(yaw),x*math.sin(yaw)+z*math.cos(yaw))for x,z in control]
    return dict(kind=NAMES[kind],control=control,branch=kind in [8,12,17,19] or (stage==9 and kind!=5),
                islands=kind in [9,13],precision=kind in [10,11],
                jump=world in [3,7] and stage in [2,8],seed=key)

def raster(level,size=28):
    geo=next(e['geo']for e in level['entities']if e['name']=='campaign-fairway')
    points=list(zip(geo['p'][::3],geo['p'][1::3],geo['p'][2::3]))
    faces=[f['idxs']for f in geo['faces']if f['material_name']=='ground']
    vertices=[points[i]for f in faces for i in f]
    xs=[p[0]for p in vertices];zs=[p[2]for p in vertices]
    cx=(min(xs)+max(xs))/2;cz=(min(zs)+max(zs))/2
    extent=max(max(xs)-min(xs),max(zs)-min(zs))*1.04
    bits=0
    def cross(a,b,p):return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
    grid=[((x-cx)*size/extent+size/2,(z-cz)*size/extent+size/2)for x,y,z in points]
    for face in faces:
        for i in range(1,len(face)-1):
            a,b,c=[grid[j]for j in [face[0],face[i],face[i+1]]]
            for z in range(max(0,int(min(a[1],b[1],c[1]))),min(size,int(max(a[1],b[1],c[1]))+1)):
                for x in range(max(0,int(min(a[0],b[0],c[0]))),min(size,int(max(a[0],b[0],c[0]))+1)):
                    mask=1<<(z*size+x)
                    if bits&mask:continue
                    p=(x+.5,z+.5);signs=[cross(a,b,p),cross(b,c,p),cross(c,a,p)]
                    if min(signs)>=-1e-7 or max(signs)<=1e-7:bits|=mask
    variants=[]
    occupied=[(i%size,i//size)for i in range(size*size)if bits>>i&1]
    for flip in [False,True]:
        cells=[(size-1-x if flip else x,z)for x,z in occupied]
        for turn in range(4):
            variants.append(sum(1<<(z*size+x)for x,z in cells));cells=[(size-1-z,x)for x,z in cells]
    return variants

def similarity(a,b):
    return max((a[0]&v).bit_count()/max(1,(a[0]|v).bit_count())for v in b)
