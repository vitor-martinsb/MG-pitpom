#include "golf/garden.h"
#include <float.h>
#include <math.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "common/graphics.h"
#include "golf/game.h"
#include "golf/golf.h"
#ifdef GOLF_PLATFORM_EMSCRIPTEN
#include <emscripten/emscripten.h>
#endif

#define WORLD_LIMIT 72000
#define FX_LIMIT 8192
#define ACTOR_LIMIT 16384
typedef struct garden_vertex { vec3 position, normal; vec4 color; } garden_vertex_t;
typedef struct garden_mesh { garden_vertex_t *vertices; int count, capacity; } garden_mesh_t;
static struct {
    golf_level_t *level;
    int level_number, entity_count;
    sg_buffer world, effects, shadows, actors;
    unsigned vertex_count;
    unsigned actor_count;
    bool replaced[1024];
    mat4 transform;
    vec3 center;
    float radius,landscape_gap;
    int biome;
    vec4 biome_color;
} garden;
static garden_vertex_t effects[FX_LIMIT], shadows[FX_LIMIT];
static garden_vertex_t actors[ACTOR_LIMIT];

static vec4 paint(float r, float g, float b, float sway) { return V4(r,g,b,sway); }
static void emit(garden_mesh_t *mesh, vec3 p, vec3 n, vec4 color) {
    if (mesh->count >= mesh->capacity) return;
    vec4 point = vec4_apply_mat(V4(p.x,p.y,p.z,1), garden.transform);
    vec4 normal = vec4_apply_mat(V4(n.x,n.y,n.z,0), garden.transform);
    mesh->vertices[mesh->count++] = (garden_vertex_t){V3(point.x,point.y,point.z),vec3_normalize(V3(normal.x,normal.y,normal.z)),color};
}
static void triangle(garden_mesh_t *mesh, vec3 a, vec3 b, vec3 c, vec4 color) {
    if (mesh->count + 3 > mesh->capacity) return;
    vec3 normal=vec3_normalize(vec3_cross(vec3_sub(b,a),vec3_sub(c,a)));
    emit(mesh,a,normal,color); emit(mesh,b,normal,color); emit(mesh,c,normal,color);
}
static vec3 sphere_point(float latitude, float longitude) {
    return V3(cosf(latitude)*cosf(longitude),sinf(latitude),cosf(latitude)*sinf(longitude));
}
static void oval(garden_mesh_t *mesh, vec3 center, vec3 size, vec4 color, int rings, int segments) {
    for(int y=0;y<rings;y++) for(int x=0;x<segments;x++) {
        vec3 points[4];
        for(int j=0;j<4;j++) {
            float latitude=-MF_PI*.5f+MF_PI*(y+(j>=2))/(float)rings;
            float longitude=2*MF_PI*(x+(j==1||j==2))/(float)segments;
            points[j]=sphere_point(latitude,longitude);
        }
        int indices[]={0,1,2,0,2,3};
        for(int j=0;j<6;j++) {
            vec3 n=points[indices[j]];
            vec3 p=V3(center.x+n.x*size.x,center.y+n.y*size.y,center.z+n.z*size.z);
            float brush=0.975f+0.025f*sinf((float)x*2.13f+(float)y*0.9f);
            emit(mesh,p,n,V4(color.x*brush,color.y*brush,color.z*brush,color.w));
        }
    }
}
static void branch(garden_mesh_t *mesh, vec3 a, vec3 b, float r0, float r1, vec4 color) {
    vec3 direction=vec3_normalize(vec3_sub(b,a));
    vec3 side=vec3_normalize(vec3_cross(direction,fabsf(direction.y)>.95f?V3(1,0,0):V3(0,1,0)));
    vec3 across=vec3_cross(direction,side);
    for(int i=0;i<7;i++) {
        float angle0=2*MF_PI*i/7,angle1=2*MF_PI*(i+1)/7;
        vec3 n0=vec3_add(vec3_scale(side,cosf(angle0)),vec3_scale(across,sinf(angle0)));
        vec3 n1=vec3_add(vec3_scale(side,cosf(angle1)),vec3_scale(across,sinf(angle1)));
        vec3 p0=vec3_add(a,vec3_scale(n0,r0)),p1=vec3_add(a,vec3_scale(n1,r0));
        vec3 p2=vec3_add(b,vec3_scale(n1,r1)),p3=vec3_add(b,vec3_scale(n0,r1));
        triangle(mesh,p0,p1,p2,color);triangle(mesh,p0,p2,p3,color);
    }
}
static void box(garden_mesh_t *mesh, vec3 p, vec3 size, vec4 color) {
    vec3 corners[8];for(int i=0;i<8;i++)corners[i]=V3(p.x+((i&1)?1:-1)*size.x,p.y+((i&2)?1:-1)*size.y,p.z+((i&4)?1:-1)*size.z);
    int faces[]={0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3};
    for(int i=0;i<36;i+=3)triangle(mesh,corners[faces[i]],corners[faces[i+1]],corners[faces[i+2]],color);
}
static float variation(int seed) { return .5f+.5f*sinf(seed*12.9898f+4.1414f); }
static bool near_course(vec3 p) {
    /* Conservative rendered-triangle bounds keep new ground decor off play surfaces. */
    for(int i=0;i<garden.level->entities.length;i++) {
        golf_entity_t *entity=&garden.level->entities.data[i];
        if(entity->type!=GEO_ENTITY) continue;
        golf_model_t *model=golf_entity_get_model(entity);
        mat4 matrix=golf_transform_get_model_mat(golf_entity_get_world_transform(garden.level,entity));
        for(int j=0;j+2<model->positions.length;j+=3) {
            float minx=FLT_MAX,minz=FLT_MAX,maxx=-FLT_MAX,maxz=-FLT_MAX;
            for(int k=0;k<3;k++) {
                vec3 v=model->positions.data[j+k];vec4 w=vec4_apply_mat(V4(v.x,v.y,v.z,1),matrix);
                minx=fminf(minx,w.x);maxx=fmaxf(maxx,w.x);minz=fminf(minz,w.z);maxz=fmaxf(maxz,w.z);
            }
            if(p.x>minx-.6f&&p.x<maxx+.6f&&p.z>minz-.6f&&p.z<maxz+.6f) return true;
        }
    }
    return false;
}
static void flower(garden_mesh_t *mesh, vec3 p, float size, int seed) {
    vec4 cream=paint(.96f,.90f,.74f,.45f),peach=paint(.87f,.59f,.43f,.45f),gold=paint(.86f,.73f,.40f,0);
    branch(mesh,p,vec3_add(p,V3(.025f,size,0)),size*.025f,size*.015f,paint(.34f,.47f,.27f,.25f));
    vec3 head=vec3_add(p,V3(.025f,size,0));
    for(int i=0;i<5;i++) {
        float angle=2*MF_PI*i/5;vec3 side=V3(-sinf(angle)*size*.10f,0,cosf(angle)*size*.10f);
        vec3 tip=vec3_add(head,V3(cosf(angle)*size*.31f,size*.03f,sinf(angle)*size*.31f));
        triangle(mesh,head,vec3_add(tip,side),vec3_add(tip,V3(0,size*.09f,0)),seed%3?cream:peach);
        triangle(mesh,head,vec3_add(tip,V3(0,size*.09f,0)),vec3_sub(tip,side),seed%3?cream:peach);
    }
    oval(mesh,head,V3(size*.085f,size*.055f,size*.085f),gold,2,6);
    triangle(mesh,vec3_add(p,V3(0,size*.4f,0)),vec3_add(p,V3(size*.25f,size*.58f,.03f)),vec3_add(p,V3(0,size*.55f,.02f)),paint(.44f,.59f,.33f,.5f));
}
static void mushroom(garden_mesh_t *mesh, vec3 p, float size) {
    branch(mesh,p,vec3_add(p,V3(0,size*.6f,0)),size*.11f,size*.09f,paint(.90f,.83f,.64f,0));
    oval(mesh,vec3_add(p,V3(0,size*.65f,0)),V3(size*.42f,size*.18f,size*.42f),paint(.70f,.40f,.29f,0),3,8);
    for(int i=0;i<5;i++) {
        float angle=2*MF_PI*i/5;vec3 c=vec3_add(p,V3(cosf(angle)*size*.22f,size*.80f,sinf(angle)*size*.22f));
        oval(mesh,c,V3(size*.06f,size*.025f,size*.06f),paint(.96f,.90f,.74f,0),2,5);
    }
}
static void grass(garden_mesh_t *mesh, vec3 p, float size, int seed) {
    for(int i=0;i<5;i++) {
        float angle=i*2.39996f+seed, height=size*(.55f+variation(seed+i)*.45f);
        vec3 side=V3(cosf(angle)*size*.06f,0,sinf(angle)*size*.06f);
        vec3 tip=vec3_add(p,V3(cosf(angle)*size*.3f,height,sinf(angle)*size*.3f));
        triangle(mesh,vec3_sub(p,side),tip,vec3_add(p,side),paint(.46f,.60f,.33f,.5f));
    }
}
static void mascot_sign(garden_mesh_t *mesh, vec3 origin, vec3 toward) {
    garden.transform=mat4_multiply(mat4_translation(origin),mat4_rotation_y(atan2f(toward.x,toward.z)));
    vec4 wood=paint(.56f,.40f,.26f,0),paper=paint(.96f,.91f,.81f,0),orange=paint(.79f,.46f,.22f,0),ink=paint(.19f,.23f,.20f,0);
    branch(mesh,V3(0,0,0),V3(0,1.4f,0),.075f,.055f,wood);
    box(mesh,V3(0,1.15f,0),V3(.62f,.34f,.07f),wood);
    box(mesh,V3(0,1.15f,.08f),V3(.57f,.29f,.025f),paper);
    // Pompom/Pom is the orange-white cat; Pituca/Pit is the black-white dog.
    oval(mesh,V3(-.28f,1.14f,.13f),V3(.18f,.18f,.025f),paper,4,8);
    triangle(mesh,V3(-.44f,1.24f,.15f),V3(-.42f,1.43f,.15f),V3(-.26f,1.26f,.15f),orange);
    triangle(mesh,V3(-.29f,1.26f,.15f),V3(-.12f,1.43f,.15f),V3(-.12f,1.23f,.15f),orange);
    oval(mesh,V3(-.35f,1.21f,.16f),V3(.075f,.07f,.015f),orange,2,6);
    oval(mesh,V3(.27f,1.14f,.13f),V3(.19f,.18f,.025f),ink,4,8);
    oval(mesh,V3(.12f,1.21f,.16f),V3(.07f,.14f,.02f),ink,3,6);
    oval(mesh,V3(.43f,1.21f,.16f),V3(.07f,.14f,.02f),ink,3,6);
    oval(mesh,V3(.27f,1.10f,.17f),V3(.09f,.08f,.012f),paper,3,7);
    oval(mesh,V3(.27f,1.22f,.17f),V3(.023f,.10f,.012f),paper,3,6);
    for(int i=0;i<4;i++){
        vec3 eye=V3((i<2?-.28f:.27f)+(i%2?-.06f:.06f),1.17f,.18f);
        oval(mesh,eye,V3(.023f,.028f,.011f),i<2?paint(.53f,.55f,.24f,0):paint(.60f,.39f,.17f,0),2,6);
        oval(mesh,vec3_add(eye,V3(0,0,.008f)),V3(.011f,.017f,.008f),ink,2,5);
    }
    oval(mesh,V3(-.28f,1.08f,.18f),V3(.022f,.015f,.013f),orange,2,5);
    oval(mesh,V3(.27f,1.08f,.18f),V3(.027f,.02f,.013f),ink,2,5);
    oval(mesh,V3(.27f,1.04f,.18f),V3(.025f,.025f,.009f),paint(.84f,.48f,.42f,0),2,5);
}
bool golf_garden_replaces_tree(const golf_entity_t *entity) {
    if(!garden.level||!entity)return false;
    ptrdiff_t index=entity-garden.level->entities.data;
    return index>=0&&index<garden.entity_count&&index<1024&&garden.replaced[index];
}
static void campaign_scenery(garden_mesh_t *mesh,vec3 min,vec3 max) {
    for(int i=0;i<18;i++) {
        float side=i%2?1:-1;
        vec3 p=V3(side>0?max.x+3.5f:min.x-3.5f,-.2f,min.z+(max.z-min.z)*(i+.5f)/18);
        if(garden.biome==7) {
            vec4 stone=paint(.30f,.25f,.28f,0),lava=paint(.86f,.36f,.18f,0);
            float s=1.2f+variation(i)*1.7f;
            for(int k=0;k<8;k++){float a=k*MF_PI/4,b=(k+1)*MF_PI/4;triangle(mesh,vec3_add(p,V3(cosf(a)*s,0,sinf(a)*s)),vec3_add(p,V3(0,s*1.6f,0)),vec3_add(p,V3(cosf(b)*s,0,sinf(b)*s)),k%3?stone:lava);}
        }else if(garden.biome==8) {
            vec4 crystal=paint(.67f,.75f,.93f,0);float h=1.2f+variation(i)*1.4f;
            for(int k=0;k<5;k++){float a=k*2*MF_PI/5,b=(k+1)*2*MF_PI/5;triangle(mesh,vec3_add(p,V3(cosf(a)*.35f,0,sinf(a)*.35f)),vec3_add(p,V3(0,h,0)),vec3_add(p,V3(cosf(b)*.35f,0,sinf(b)*.35f)),crystal);}
            vec3 star=vec3_add(p,V3(side*2,5+variation(i+3)*7,0));
            for(int k=0;k<4;k++){float a=k*MF_PI/2;triangle(mesh,star,vec3_add(star,V3(cosf(a)*.45f,sinf(a)*.45f,0)),vec3_add(star,V3(cosf(a+.6f)*.13f,sinf(a+.6f)*.13f,0)),paint(.98f,.92f,.70f,0));}
        }else if(garden.biome==2) {
            for(int reed=0;reed<4;reed++){vec3 q=vec3_add(p,V3(reed*.18f,0,0));branch(mesh,q,vec3_add(q,V3(.12f,1.5f+variation(i)*.8f,0)),.035f,.018f,paint(.43f,.62f,.45f,.4f));}
            oval(mesh,vec3_add(p,V3(0,.08f,0)),V3(.7f,.08f,.7f),paint(.51f,.66f,.44f,0),2,8);
        }else if(garden.biome==6) {
            mushroom(mesh,p,.9f+variation(i)*.8f);flower(mesh,vec3_add(p,V3(.6f,0,.3f)),.5f,i);
        }else if(garden.biome==3) {
            oval(mesh,p,V3(.9f,.6f,.7f),paint(.64f,.67f,.58f,0),3,8);
            for(int k=0;k<5;k++){float a=k*MF_PI/4;vec3 q=vec3_add(p,V3(cosf(a)*.55f,.8f+sinf(a),0));oval(mesh,q,V3(.22f,.22f,.22f),paint(.84f,.75f,.57f,0),2,7);}
        }else if(garden.biome==4) {
            branch(mesh,p,vec3_add(p,V3(0,2.2f,0)),.015f,.015f,paint(.75f,.65f,.46f,0));
            oval(mesh,vec3_add(p,V3(0,2.7f,0)),V3(.55f,.7f,.5f),i%2?paint(.91f,.65f,.54f,0):paint(.77f,.70f,.87f,0),4,8);
        }else {
            branch(mesh,p,vec3_add(p,V3(0,1.8f,0)),.13f,.08f,paint(.55f,.40f,.28f,0));
            vec4 leaf=garden.biome==10?paint(.81f,.70f,.42f,1):paint(.49f,.65f,.39f,1);
            oval(mesh,vec3_add(p,V3(0,2,0)),V3(1.05f,1.2f,.9f),leaf,4,9);
            flower(mesh,vec3_add(p,V3(.7f,0,.3f)),.45f,i);
            if(garden.biome==5)for(int k=0;k<3;k++)grass(mesh,vec3_add(p,V3(k*.3f,0,-.7f)),.7f,i+k);
        }
    }
}
void golf_garden_prepare(golf_level_t *level, int level_number) {
    if(garden.level==level&&garden.level_number==level_number&&garden.entity_count==level->entities.length)return;
    if(garden.world.id)sg_destroy_buffer(garden.world);
    garden.level=level;garden.level_number=level_number;garden.entity_count=level->entities.length;
    memset(garden.replaced,0,sizeof(garden.replaced));garden.vertex_count=0;
    garden_mesh_t mesh={calloc(WORLD_LIMIT,sizeof(garden_vertex_t)),0,WORLD_LIMIT};
    if(!mesh.vertices)return;
    vec3 start=golf_game_get_local_player()->ball.start_pos;
    garden.center=start;garden.radius=28;
    garden.transform=mat4_identity();
    garden.biome=0;garden.biome_color=paint(.48f,.64f,.48f,0);
    vec3 course_min=start,course_max=start;
    for(int i=0;i<level->entities.length;i++) {
        golf_entity_t *e=&level->entities.data[i];int stage,number;
        if(e->type==GROUP_ENTITY&&sscanf(e->name,"campaign:%d:%d:%d",&garden.biome,&stage,&number)==3) {
            golf_material_t ground;if(golf_level_get_material(level,"biome-palette",&ground))garden.biome_color=ground.color;
        }
        if(e->type==GEO_ENTITY&&!strcmp(e->name,"campaign-fairway"))for(int j=0;j<e->geo.geo.points.length;j++) {
            vec3 p=e->geo.geo.points.data[j].position;
            course_min=V3(fminf(course_min.x,p.x),fminf(course_min.y,p.y),fminf(course_min.z,p.z));
            course_max=V3(fmaxf(course_max.x,p.x),fmaxf(course_max.y,p.y),fmaxf(course_max.z,p.z));
        }
    }
    if(garden.biome){garden.center=vec3_scale(vec3_add(course_min,course_max),.5f);garden.radius=fmaxf(28,vec3_distance(course_min,course_max)*.5f+10);campaign_scenery(&mesh,course_min,course_max);}
    bool sign_added=false;int trees=0;
    for(int i=0;i<level->entities.length&&i<1024;i++) {
        golf_entity_t *entity=&level->entities.data[i];
        if(entity->type!=MODEL_ENTITY||!strstr(entity->model.model_path,"/tree_")||mesh.count>WORLD_LIMIT-16000)continue;
        golf_model_t *model=entity->model.model;if(!model||!model->positions.length)continue;
        vec3 min=V3(FLT_MAX,FLT_MAX,FLT_MAX),max=V3(-FLT_MAX,-FLT_MAX,-FLT_MAX);
        for(int j=0;j<model->positions.length;j++){vec3 p=model->positions.data[j];min=V3(fminf(min.x,p.x),fminf(min.y,p.y),fminf(min.z,p.z));max=V3(fmaxf(max.x,p.x),fmaxf(max.y,p.y),fmaxf(max.z,p.z));}
        float h=max.y-min.y,r=fmaxf(h*.25f,fmaxf(.2f,fmaxf(max.x-min.x,max.z-min.z)*.48f));
        golf_transform_t transform=golf_entity_get_world_transform(level,entity);
        garden.transform=golf_transform_get_model_mat(transform);garden.replaced[i]=true;trees++;
        vec4 bark=paint(.49f,.36f,.24f,0);
        branch(&mesh,V3(0,min.y,0),V3(.07f*h,min.y+h*.38f,.015f*h),h*.065f,h*.045f,bark);
        branch(&mesh,V3(.07f*h,min.y+h*.38f,.015f*h),V3(0,min.y+h*.76f,0),h*.045f,h*.024f,bark);
        for(int j=0;j<5;j++) {
            float angle=2*MF_PI*j/5+variation(i)*.6f;
            vec3 c=V3(cosf(angle)*r*.38f,min.y+h*(.64f+variation(i*7+j)*.16f),sinf(angle)*r*.38f);
            branch(&mesh,V3(.03f*h,min.y+h*.42f,0),c,h*.03f,h*.015f,bark);
            float tint=variation(i*13+j)*.10f;
            oval(&mesh,c,V3(r*(.70f+variation(j)*.1f),h*.23f,r*.71f),paint(.39f+tint,.54f+tint,.31f+tint*.7f,1),5,9);
        }
        oval(&mesh,V3(-r*.12f,min.y+h*.85f,r*.08f),V3(r*.80f,h*.19f,r*.73f),paint(.53f,.64f,.38f,1),4,9);
        garden.radius=fmaxf(garden.radius,vec3_distance(start,transform.position)+10);
        garden.transform=mat4_identity();
        float scale=fmaxf(.5f,fminf(3,transform.scale.y));
        for(int j=0;j<7;j++) {
            float angle=2*MF_PI*j/7+variation(i+j),distance=(r*transform.scale.x+1.1f)*(1.0f+variation(i*17+j)*.4f);
            vec3 p=vec3_add(transform.position,V3(cosf(angle)*distance,.12f*scale,sinf(angle)*distance));
            if(near_course(p))continue;
            flower(&mesh,p,.25f*scale+(j%3)*.08f,i+j);
            grass(&mesh,vec3_add(p,V3(-.23f,0,.15f)),.28f*scale,i+j);
            if(j==3){
                oval(&mesh,vec3_add(p,V3(0,.22f*scale,0)),V3(.43f*scale,.33f*scale,.35f*scale),paint(.43f,.56f,.33f,1),3,8);
                oval(&mesh,vec3_add(p,V3(.25f*scale,.16f*scale,.11f*scale)),V3(.30f*scale,.22f*scale,.24f*scale),paint(.52f,.63f,.38f,1),3,7);
            }
            if(j==1)mushroom(&mesh,vec3_add(p,V3(.35f,0,.2f)),.3f*scale);
            if(j==4){oval(&mesh,p,V3(.30f*scale,.17f*scale,.24f*scale),paint(.53f,.57f,.44f,0),3,7);oval(&mesh,vec3_add(p,V3(0,.13f*scale,0)),V3(.21f*scale,.065f*scale,.17f*scale),paint(.39f,.51f,.30f,0),2,7);}
            if(!sign_added&&j==0){mascot_sign(&mesh,p,vec3_sub(start,p));sign_added=true;garden.transform=mat4_identity();}
        }
    }
    garden.transform=mat4_identity();
    // A distant landscape ring gives the small courses a larger painted world.
    float radius=garden.biome?fmaxf(36,garden.radius+16):fminf(65,fmaxf(36,garden.radius+8));garden.radius=radius;
    vec3 landscape_center=garden.biome?V3(garden.center.x,start.y,garden.center.z):start;
    float reach=hypotf(fmaxf(fabsf(course_min.x-landscape_center.x),fabsf(course_max.x-landscape_center.x)),
                       fmaxf(fabsf(course_min.z-landscape_center.z),fabsf(course_max.z-landscape_center.z)));
    garden.landscape_gap=radius-reach-16;
    for(int i=0;i<10;i++) {
        float a=2*MF_PI*i/10;vec3 p=vec3_add(landscape_center,V3(cosf(a)*radius,-6,sinf(a)*radius));
        vec4 hill=garden.biome?paint(garden.biome_color.x*.75f,garden.biome_color.y*.80f,garden.biome_color.z*.75f,0):paint(.48f,.64f,.48f,0);
        if(garden.biome==8)hill=paint(.28f,.33f,.49f,0);
        oval(&mesh,p,V3(16,8+variation(i)*8,14),hill,4,10);
        vec3 cloud=vec3_add(landscape_center,V3(cosf(a)*radius*.8f,18+variation(i+3)*6,sinf(a)*radius*.8f));
        for(int j=0;j<3;j++)oval(&mesh,vec3_add(cloud,V3((j-1)*3,variation(j+i),0)),V3(4.3f,1.5f+variation(i+j),2.2f),paint(.96f,.95f,.87f,2),4,9);
    }
    garden.world=sg_make_buffer(&(sg_buffer_desc){.data={mesh.vertices,(size_t)mesh.count*sizeof(garden_vertex_t)}});
    garden.vertex_count=(unsigned)mesh.count;free(mesh.vertices);
    if(!garden.effects.id)garden.effects=sg_make_buffer(&(sg_buffer_desc){.size=sizeof(effects),.usage=SG_USAGE_STREAM});
    if(!garden.shadows.id)garden.shadows=sg_make_buffer(&(sg_buffer_desc){.size=sizeof(shadows),.usage=SG_USAGE_STREAM});
    if(!garden.actors.id)garden.actors=sg_make_buffer(&(sg_buffer_desc){.size=sizeof(actors),.usage=SG_USAGE_STREAM});
    (void)trees;
}
static void render(sg_buffer buffer, int count, float time, bool transparent, vec4 style) {
    if(!count)return;
    golf_graphics_t *graphics=golf_graphics_get();golf_shader_t *shader=golf_data_get_shader("data/shaders/garden.glsl");
    golf_shader_pipeline_t *pipeline=golf_shader_get_pipeline(shader,transparent?"garden_shadow":"garden");
    sg_apply_pipeline(pipeline->sg_pipeline);sg_apply_bindings(&(sg_bindings){.vertex_buffers[0]=buffer,.fs_images[0]=golf_data_get_texture("data/textures/garden/meadow.png")->sg_image});
    golf_shader_uniform_t *vs=golf_shader_vs_uniform_setup(shader,"garden_vs_params",2,UNIFORM_MAT4("proj_view_mat",mat4_transpose(graphics->proj_view_mat)),UNIFORM_VEC4("motion",V4(time,0,0,0)));
    golf_shader_uniform_t *fs=golf_shader_fs_uniform_setup(shader,"garden_fs_params",2,UNIFORM_VEC4("camera_position",V4(graphics->cam_pos.x,graphics->cam_pos.y,graphics->cam_pos.z,1)),UNIFORM_VEC4("style",style));
    sg_apply_uniforms(SG_SHADERSTAGE_VS,0,&(sg_range){vs->data,vs->size});sg_apply_uniforms(SG_SHADERSTAGE_FS,0,&(sg_range){fs->data,fs->size});sg_draw(0,count,1);
}
void golf_garden_draw_world(float time){render(garden.world,(int)garden.vertex_count,time,false,V4(1,1,1,0));}
vec4 golf_garden_sky_color(void) {
    if(golf_get()->state!=GOLF_STATE_IN_GAME||!garden.biome)return V4(.659f,.847f,.910f,1);
    if(garden.biome==8)return V4(.15f,.19f,.32f,1);
    if(garden.biome==7)return V4(.84f,.61f,.49f,1);
    if(garden.biome==6)return V4(.78f,.73f,.88f,1);
    if(garden.biome==10)return V4(.94f,.85f,.67f,1);
    return V4(.64f+garden.biome_color.x*.20f,.68f+garden.biome_color.y*.20f,.72f+garden.biome_color.z*.18f,1);
}
static void animal(garden_mesh_t *mesh,vec3 position,bool cat,float time,float event_age,vec3 forward) {
    garden.transform=mat4_multiply(mat4_translation(position),mat4_rotation_y(atan2f(forward.x,forward.z)));
    vec4 white=paint(.96f,.91f,.79f,0),orange=paint(.83f,.46f,.20f,0),black=paint(.14f,.17f,.16f,0),pink=paint(.88f,.51f,.46f,0);
    vec4 coat=cat?orange:white;
    float awake=cat?1:golf_clampf(event_age/.22f,0,1)*(1-golf_clampf((event_age-1.0f)/.5f,0,1));
    float breath=.012f*sinf(golf_garden_flag_time()*2.2f),height=cat?.34f:.22f+awake*.19f;
    oval(mesh,V3(0,height+breath,0),cat?V3(.22f,.22f,.40f):V3(.30f,.22f,.49f),coat,4,9);
    if(!cat){oval(mesh,V3(-.19f,height+.07f,-.14f),V3(.13f,.14f,.22f),black,3,7);oval(mesh,V3(.16f,height+.09f,-.24f),V3(.15f,.14f,.19f),black,3,7);}
    oval(mesh,V3(0,height,.27f),V3(cat?.17f:.22f,.20f,.14f),white,3,8);
    for(int i=0;i<4;i++) {
        float x=(i&1?1:-1)*(cat?.13f:.21f),z=i<2?.25f:-.27f;
        float step=cat?.05f*sinf(time*6+i*MF_PI*.5f):0;
        float paw_y=cat?.07f:.055f;
        if(cat&&i==0&&event_age>=0&&event_age<.4f){z+=.27f*sinf(event_age/.4f*MF_PI);paw_y+=.16f*sinf(event_age/.4f*MF_PI);}
        branch(mesh,V3(x,height-.07f,z),V3(x,paw_y+fabsf(step),z+step),cat?.06f:.085f,cat?.045f:.06f,white);
        oval(mesh,V3(x,paw_y+fabsf(step),z+step),V3(cat?.065f:.09f,.055f,.10f),white,2,6);
    }
    float head_y=cat?.64f:.42f+awake*.29f;
    oval(mesh,V3(0,head_y,.32f),V3(cat?.25f:.27f,cat?.22f:.245f,.24f),cat?orange:black,4,9);
    if(cat) {
        for(int side=-1;side<=1;side+=2){
            triangle(mesh,V3(side*.23f,head_y+.06f,.3f),V3(side*.20f,head_y+.38f,.28f),V3(side*.06f,head_y+.18f,.43f),orange);
            triangle(mesh,V3(side*.20f,head_y+.10f,.44f),V3(side*.18f,head_y+.31f,.32f),V3(side*.09f,head_y+.16f,.45f),pink);
        }
        for(int stripe=0;stripe<3;stripe++)oval(mesh,V3((stripe-1)*.075f,head_y+.14f,.48f),V3(.016f,.075f,.016f),paint(.58f,.30f,.15f,0),2,5);
        // Pompom alone has the curved orange tail with its white tip.
        branch(mesh,V3(0,height,-.35f),V3(.13f,.57f,-.65f),.055f,.045f,orange);
        branch(mesh,V3(.13f,.57f,-.65f),V3(.30f,.61f,-.59f),.045f,.055f,white);
    } else {
        // Pituca has short fur, floppy black ears, white blaze and no tail.
        float ear=.025f*sinf(golf_garden_flag_time()*1.7f);
        oval(mesh,V3(-.27f,head_y-.02f+ear,.25f),V3(.11f,.23f,.13f),black,3,7);
        oval(mesh,V3(.27f,head_y-.02f-ear,.25f),V3(.11f,.23f,.13f),black,3,7);
        oval(mesh,V3(.015f,head_y+.05f,.54f),V3(.043f,.19f,.012f),white,3,6);
        for(int spot=0;spot<7;spot++)oval(mesh,V3((spot%3-1)*.063f,height+(spot/3)*.055f,.397f),V3(.015f,.018f,.011f),black,2,5);
    }
    oval(mesh,V3(0,head_y-.07f,.52f),V3(cat?.14f:.18f,.10f,.13f),white,3,7);
    for(int side=-1;side<=1;side+=2){
        oval(mesh,V3(side*.115f,head_y+.045f,.522f),V3(.061f,.07f,.015f),cat?paint(.59f,.63f,.29f,0):paint(.56f,.37f,.18f,0),3,7);
        oval(mesh,V3(side*.115f,head_y+.045f,.54f),V3(cat?.017f:.030f,.045f,.009f),black,2,6);
        oval(mesh,V3(side*.105f,head_y+.065f,.55f),V3(.010f,.012f,.008f),white,2,5);
    }
    oval(mesh,V3(0,head_y-.04f,.654f),V3(cat?.035f:.057f,.028f,.026f),cat?pink:black,2,6);
    if(!cat&&awake>.15f){oval(mesh,V3(0,head_y-.12f,.60f),V3(.08f,.04f+awake*.05f,.025f),black,2,7);oval(mesh,V3(.02f,head_y-.15f,.633f),V3(.036f,.043f,.014f),pink,2,6);}
    garden.transform=mat4_identity();
}
static void wild_animal(garden_mesh_t *mesh,const golf_wild_animal_t *a,int kind,float time,golf_game_t *game) {
    garden.transform=mat4_multiply(mat4_translation(a->pos),mat4_rotation_y(atan2f(a->forward.x,a->forward.z)));
    vec4 black=paint(.10f,.11f,.13f,0),cream=paint(.97f,.93f,.83f,0),pink=paint(.91f,.58f,.55f,0);
    float age=time-a->action_time;bool acting=age>=0&&age<1.15f;
    float step=a->walking?sinf(a->clock*(kind==2?5.0f:7.0f)):0;
    float height=kind==2?.36f:.32f,body=kind==1?.46f:.34f;
    vec4 coat=kind==2?cream:black;
    float torso_y=height+fabsf(step)*.015f;
    oval(mesh,V3(0,torso_y,-.04f),V3(.23f,.21f,body),coat,4,9);
    if(kind==0) {
        // A soft crocheted vest, raised alternating stitches, curly black fur.
        oval(mesh,V3(0,torso_y+.01f,-.05f),V3(.25f,.235f,.35f),paint(.62f,.64f,.66f,0),4,12);
        for(int row=0;row<4;row++)for(int stitch_index=0;stitch_index<10;stitch_index++) {
            float y=torso_y-.09f+row*.055f;
            float dy=(y-torso_y-.01f)/.235f,ring=sqrtf(fmaxf(0,1-dy*dy));
            float a=stitch_index*2*MF_PI/10,b=a+.20f;
            vec4 stitch=row==1?paint(.28f,.46f,.70f,0):row==2?paint(.74f,.30f,.30f,0):cream;
            branch(mesh,V3(cosf(a)*.254f*ring,y,-.05f+sinf(a)*.355f*ring),
                        V3(cosf(b)*.254f*ring,y+.018f,-.05f+sinf(b)*.355f*ring),.012f,.012f,stitch);
        }
    }
    for(int leg=0;leg<4;leg++) {
        float x=(leg%2?1:-1)*.16f,z=leg<2?.23f:-body*.75f;
        float stride=step*(leg%2?-.05f:.05f),paw=.055f+fabsf(stride)*.6f;
        if(acting&&kind==0&&leg==2){x-=.18f;paw+=.22f*sinf(golf_clampf(age/.7f,0,1)*MF_PI);}
        if(acting&&kind==2&&leg<2){z+=.22f*sinf(golf_clampf(age/.7f,0,1)*MF_PI);paw+=.06f;}
        branch(mesh,V3(x*.8f,height-.08f,z),V3(x,paw,z+stride),.055f,.04f,coat);
        oval(mesh,V3(x,paw,z+stride),V3(.065f,.05f,.095f),coat,2,6);
    }
    float head_y=kind==0?.65f:.61f;
    if(acting&&kind==1)head_y+=.045f*sinf(age*10);
    oval(mesh,V3(0,head_y,.29f),V3(.225f,.21f,.22f),kind==2?cream:black,4,9);
    if(kind==0)for(int curl=0;curl<14;curl++) {
        float theta=curl*2.39996f,r=.16f+.025f*sinf(curl*1.7f);
        oval(mesh,V3(cosf(theta)*r,head_y+.1f+sinf(theta)*.12f,.28f+.04f*cosf(curl)),V3(.075f,.071f,.073f),paint(.14f,.15f,.17f,0),2,6);
    }
    for(int side=-1;side<=1;side+=2) {
        if(kind==2) {
            triangle(mesh,V3(side*.21f,head_y+.06f,.22f),V3(side*.19f,head_y+.31f,.23f),V3(side*.06f,head_y+.14f,.39f),black);
            triangle(mesh,V3(side*.18f,head_y+.10f,.39f),V3(side*.17f,head_y+.24f,.25f),V3(side*.10f,head_y+.14f,.40f),pink);
            oval(mesh,V3(side*.125f,head_y+.025f,.43f),V3(.095f,.115f,.055f),black,3,7);
        }else oval(mesh,V3(side*.23f,head_y-.03f+step*.02f,.21f),V3(kind==0?.12f:.09f,kind==0?.17f:.20f,.11f),black,3,7);
        oval(mesh,V3(side*.103f,head_y+.035f,.482f),V3(.055f,.065f,.016f),kind==2?paint(.72f,.62f,.30f,0):paint(.49f,.34f,.20f,0),3,7);
        oval(mesh,V3(side*.103f,head_y+.035f,.497f),V3(.028f,.043f,.009f),black,2,6);
        oval(mesh,V3(side*.093f,head_y+.054f,.507f),V3(.012f,.015f,.007f),cream,2,5);
    }
    oval(mesh,V3(0,head_y-.07f,.48f),V3(kind==1?.13f:.12f,.075f,.115f),kind==2?cream:paint(.19f,.18f,.18f,0),3,7);
    oval(mesh,V3(0,head_y-.04f,.587f),V3(.036f,.026f,.025f),kind==2?pink:black,2,6);
    if(kind==2) {
        branch(mesh,V3(0,height,-body),V3(.12f,.49f,-.65f),.045f,.035f,cream);
        branch(mesh,V3(.12f,.49f,-.65f),V3(.20f+.07f*sinf(time*2),.67f,-.68f),.035f,.038f,black);
    }else branch(mesh,V3(0,height,-body),V3(.08f*sinf(time*(acting?10:3)),.55f,-body-.19f),.04f,.025f,black);
    if(acting&&kind==0&&age<.8f)for(int dot=0;dot<6;dot++) {
        float t=fmodf(age*3+dot/6.f,1);
        oval(mesh,V3(-.22f+t*.2f,.30f*(1-t),-.18f+t*.75f),V3(.014f,.018f,.014f),paint(.89f,.79f,.35f,0),2,5);
    }
    if(acting&&kind>0) {
        vec4 color=paint(.93f,.72f,.42f,0);bool carrying=false;
        for(int i=0;i<game->player_count;i++)if(game->players[i].ball.capture_kind==kind+1){color=game->players[i].color;carrying=true;break;}
        if(carrying)oval(mesh,V3(0,head_y-.12f,.60f),V3(.10f,.10f,.10f),color,3,8);
    }
    garden.transform=mat4_identity();
}
static void campaign_obstacles(garden_mesh_t *mesh,const golf_wildlife_t *w,float time) {
    for(int i=0;i<w->portal_count;i++)if(w->portals[i].active) {
        garden.transform=mat4_translation(w->portals[i].pos);
        vec4 color=i%2?paint(.91f,.65f,.42f,0):paint(.63f,.62f,.87f,0);
        for(int j=0;j<16;j++) {
            float a=j*2*MF_PI/16,b=(j+1)*2*MF_PI/16;
            branch(mesh,V3(cosf(a)*.54f,.68f+sinf(a)*.64f,0),V3(cosf(b)*.54f,.68f+sinf(b)*.64f,0),.045f,.045f,color);
        }
        garden.transform=mat4_identity();
    }
    for(int i=0;i<w->wind_count;i++) {
        vec3 p=w->wind[i].pos;p.x+=(w->wind[i].strength>0?-1:1)*(w->wind[i].size.x+.3f);
        garden.transform=mat4_multiply(mat4_translation(p),mat4_rotation_y(MF_PI*.5f));
        branch(mesh,V3(0,0,0),V3(0,.9f,0),.05f,.035f,paint(.52f,.43f,.32f,0));
        oval(mesh,V3(0,.9f,0),V3(.08f,.08f,.08f),paint(.77f,.71f,.53f,0),2,6);
        for(int blade=0;blade<4;blade++) {
            float a=time*4+blade*MF_PI*.5f,b=a+.5f;
            triangle(mesh,V3(0,.9f,.02f),V3(cosf(a)*.42f,.9f+sinf(a)*.42f,.02f),V3(cosf(b)*.34f,.9f+sinf(b)*.34f,.02f),paint(.70f,.78f,.68f,0));
        }
        garden.transform=mat4_identity();
    }
}
vec3 golf_garden_flag_point(float u,float side,float time) {
    float gust=.75f+.25f*sinf(time*.32f),wave=sinf(time*1.4f-u*9);
    return V3(u*.055f*gust*wave,.919f+side*.122f*(1-u)+u*.012f*wave,.35f*u);
}
float golf_garden_flag_time(void) {
    golf_t *golf=golf_get();
    return golf->state==GOLF_STATE_IN_GAME?golf->in_game.t:golf->main_menu.t;
}
static void wind_flag(garden_mesh_t *mesh,golf_entity_t *entity,float time) {
    garden.transform=golf_transform_get_model_mat(golf_entity_get_world_transform(garden.level,entity));
    vec4 pole=paint(.74f,.65f,.44f,0),red=paint(.80f,.28f,.20f,0);
    branch(mesh,V3(0,0,0),V3(0,1.05f,0),.017f,.014f,pole);
    oval(mesh,V3(0,1.055f,0),V3(.027f,.027f,.027f),pole,2,6);
    for(int i=0;i<12;i++) {
        vec3 vertices[4];
        for(int j=0;j<4;j++) {
            float u=(i+(j==1||j==2))/12.f;
            vertices[j]=golf_garden_flag_point(u,j>=2?1:-1,time);
        }
        triangle(mesh,vertices[0],vertices[1],vertices[2],red);triangle(mesh,vertices[0],vertices[2],vertices[3],red);
        triangle(mesh,vertices[2],vertices[1],vertices[0],red);triangle(mesh,vertices[3],vertices[2],vertices[0],red);
    }
    garden.transform=mat4_identity();
}
bool golf_garden_replaces_flag(const golf_entity_t *e) {
    return e->type==MODEL_ENTITY&&e->model.ignore_physics&&strstr(e->model.model_path,"/flag_");
}
static vec3 dog_facing(golf_game_t *game) {
    vec3 forward=vec3_sub(game->mechanics.start,game->mechanics.dog);
    float nearest=FLT_MAX;bool following_incoming=false;
    for(int i=0;i<game->player_count;i++) {
        golf_player_t *p=&game->players[i];
        if(!golf_game_player_visible(p)||p->ball.is_in_hole||p->ball.capture_until>0||
           p->ball.is_out_of_bounds||p->ball.is_in_water)continue;
        vec3 toward=vec3_sub(p->ball.draw_pos,game->mechanics.dog);toward.y=0;
        float distance=vec3_dot(toward,toward);
        if(distance<.01f)continue;
        bool incoming=p->ball.is_moving&&vec3_dot(toward,p->ball.vel)<0;
        if((incoming&&!following_incoming)||(incoming==following_incoming&&distance<nearest)) {
            forward=toward;nearest=distance;following_incoming=incoming;
        }
    }
    forward.y=0;
    return vec3_length(forward)>.01f?vec3_normalize(forward):vec3_scale(game->mechanics.direction,-1);
}
void golf_garden_draw_feedback(float time) {
    garden.transform=mat4_identity();garden_mesh_t shadow={shadows,0,FX_LIMIT},fx={effects,0,FX_LIMIT};
    golf_game_t *game=golf_game_get();
    garden_mesh_t actor={actors,0,ACTOR_LIMIT};
    for(int i=0;i<garden.level->entities.length;i++)if(golf_garden_replaces_flag(&garden.level->entities.data[i]))wind_flag(&actor,&garden.level->entities.data[i],golf_garden_flag_time());
    if(golf_get()->state==GOLF_STATE_IN_GAME&&game->mechanics.enabled){
        vec3 forward=game->mechanics.across;if(cosf(time*.75f)<0)forward=vec3_scale(forward,-1);
        if(game->mechanics.cat_valid)animal(&actor,game->mechanics.cat,true,time,time-game->mechanics.cat_slap_time,forward);
        if(game->mechanics.dog_valid)animal(&actor,game->mechanics.dog,false,time,time-game->mechanics.dog_wake_time,dog_facing(game));
        for(int kind=0;kind<3;kind++)if(game->mechanics.wildlife.animals[kind].active)
            wild_animal(&actor,&game->mechanics.wildlife.animals[kind],kind,time,game);
        campaign_obstacles(&actor,&game->mechanics.wildlife,time);
        if(game->mechanics.impact)for(int i=0;i<game->player_count;i++){
            golf_player_t *p=&game->players[i];if(!golf_game_player_visible(p)||p->ball.first_shot_complete||p->ball.is_in_hole)continue;
            vec3 center=vec3_add(p->ball.draw_pos,V3(0,.02f,0));
            for(int k=0;k<8;k++){
                float a=k*MF_PI/4,b=(k+1)*MF_PI/4;float r=.15f+.008f*sinf(golf_garden_flag_time()*2);
                vec3 a0=vec3_add(center,V3(cosf(a)*r,0,sinf(a)*r)),b0=vec3_add(center,V3(cosf(b)*r,0,sinf(b)*r));
                vec3 a1=vec3_add(center,V3(cosf(a)*(r+.012f),0,sinf(a)*(r+.012f))),b1=vec3_add(center,V3(cosf(b)*(r+.012f),0,sinf(b)*(r+.012f)));
                triangle(&fx,a0,b0,b1,paint(.69f,.91f,1,0));triangle(&fx,a0,b1,a1,paint(.69f,.91f,1,0));
            }
        }
    }
    garden.actor_count=(unsigned)actor.count;
    if(actor.count){sg_update_buffer(garden.actors,&(sg_range){actors,(size_t)actor.count*sizeof(garden_vertex_t)});render(garden.actors,actor.count,time,false,V4(1,1,0,0));}
    for(int i=0;i<game->player_count;i++) {
        golf_player_t *player=&game->players[i];if(!golf_game_player_visible(player)||player->ball.is_in_hole)continue;
        vec3 p=player->ball.draw_pos;p.y-=player->ball.radius-.004f;
        if(player->ball.slow_until>time)for(int dot=0;dot<6;dot++) {
            float a=time*1.3f+dot*MF_PI/3;
            vec3 q=vec3_add(p,V3(cosf(a)*.20f,.035f,sinf(a)*.20f));
            triangle(&fx,q,vec3_add(q,V3(.025f,.035f,0)),vec3_add(q,V3(.04f,0,.02f)),paint(.93f,.79f,.30f,0));
        }
        if(player->ball.effect_serial&&player->ball.effect_kind>=3&&time-player->ball.effect_time<1.3f) {
            for(int dot=0;dot<8;dot++) {
                float a=dot*MF_PI/4+time*3,r=.24f+.12f*sinf(time*5);
                vec3 q=vec3_add(p,V3(cosf(a)*r,.09f+dot*.02f,sinf(a)*r));
                triangle(&fx,q,vec3_add(q,V3(.035f,.045f,0)),vec3_add(q,V3(.055f,0,.035f)),paint(.75f,.63f,.90f,0));
            }
        }
        float r=player->ball.radius*1.2f;
        for(int j=0;j<12;j++) {
            float a=2*MF_PI*j/12,b=2*MF_PI*(j+1)/12;
            triangle(&shadow,p,vec3_add(p,V3(cosf(a)*r,0,sinf(a)*r)),vec3_add(p,V3(cosf(b)*r,0,sinf(b)*r)),paint(.22f,.27f,.16f,0));
        }
        if(player->id==game->local_player_id)for(int j=0;j<32;j++) {
            float a=2*MF_PI*j/32,b=2*MF_PI*(j+1)/32;r=player->ball.radius*1.55f;
            vec3 a0=vec3_add(p,V3(cosf(a)*r,.006f,sinf(a)*r)),a1=vec3_add(p,V3(cosf(b)*r,.006f,sinf(b)*r));
            vec3 b0=vec3_add(p,V3(cosf(a)*(r+.022f),.006f,sinf(a)*(r+.022f))),b1=vec3_add(p,V3(cosf(b)*(r+.022f),.006f,sinf(b)*(r+.022f)));
            triangle(&fx,a0,a1,b1,paint(.94f,.82f,.51f,0));triangle(&fx,a0,b1,b0,paint(.94f,.82f,.51f,0));
        }
    }
    // Sparse local butterflies and falling leaves; no network messages or colliders.
    for(int i=0;i<14;i++) {
        float a=time*.10f+i*2.39996f,r=8+variation(i)*12;
        vec3 p=vec3_add(garden.center,V3(cosf(a)*r,1.5f+variation(i)*2+sinf(time*.7f+i)*.25f,sinf(a)*r));
        float wing=.12f+.055f*sinf(time*4+i),lift=.05f*cosf(time*4+i);
        vec4 color=i%3?paint(.86f,.74f,.43f,0):paint(.95f,.87f,.70f,0);
        triangle(&fx,p,vec3_add(p,V3(-wing,lift,.07f)),vec3_add(p,V3(-wing,lift,-.07f)),color);
        triangle(&fx,p,vec3_add(p,V3(wing,lift,-.07f)),vec3_add(p,V3(wing,lift,.07f)),color);
        if(i<6){vec3 leaf=vec3_add(p,V3(1,2+fmodf(i-time*.12f+100,3),1));triangle(&fx,leaf,vec3_add(leaf,V3(.12f,.015f,.03f)),vec3_add(leaf,V3(.03f,.05f,.12f)),paint(.62f,.67f,.37f,0));}
    }
    if(shadow.count){sg_update_buffer(garden.shadows,&(sg_range){shadows,(size_t)shadow.count*sizeof(garden_vertex_t)});render(garden.shadows,shadow.count,time,true,V4(.17f,0,0,0));}
    if(fx.count){sg_update_buffer(garden.effects,&(sg_range){effects,(size_t)fx.count*sizeof(garden_vertex_t)});render(garden.effects,fx.count,time,false,V4(1,1,0,0));}
}
golf_texture_t *golf_garden_material(const golf_material_t *material, float *kind) {
    const char *path=material->texture_path;*kind=0;
    if(strstr(path,"grass")||strstr(path,"ground")||strstr(material->name,"_ground")){*kind=1;return golf_data_get_texture("data/textures/garden/meadow.png");}
    if(strstr(path,"wood")){*kind=2;return golf_data_get_texture("data/textures/garden/cedar.png");}
    return material->texture;
}
#ifdef GOLF_PLATFORM_EMSCRIPTEN
EMSCRIPTEN_KEEPALIVE
#endif
unsigned golf_garden_vertex_count(void){return garden.vertex_count;}
unsigned golf_garden_actor_vertex_count(void){return garden.actor_count;}
float golf_garden_landscape_gap(void){return garden.landscape_gap;}
