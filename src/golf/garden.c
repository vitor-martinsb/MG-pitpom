#include "golf/garden.h"
#include <float.h>
#include <math.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include "common/graphics.h"
#include "golf/game.h"
#ifdef GOLF_PLATFORM_EMSCRIPTEN
#include <emscripten/emscripten.h>
#endif

#define WORLD_LIMIT 72000
#define FX_LIMIT 4096
typedef struct garden_vertex { vec3 position, normal; vec4 color; } garden_vertex_t;
typedef struct garden_mesh { garden_vertex_t *vertices; int count, capacity; } garden_mesh_t;
static struct {
    golf_level_t *level;
    int level_number, entity_count;
    sg_buffer world, effects, shadows;
    unsigned vertex_count;
    bool replaced[1024];
    mat4 transform;
    vec3 center;
    float radius;
} garden;
static garden_vertex_t effects[FX_LIMIT], shadows[FX_LIMIT];

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
void golf_garden_prepare(golf_level_t *level, int level_number) {
    if(garden.level==level&&garden.level_number==level_number&&garden.entity_count==level->entities.length)return;
    if(garden.world.id)sg_destroy_buffer(garden.world);
    garden.level=level;garden.level_number=level_number;garden.entity_count=level->entities.length;
    memset(garden.replaced,0,sizeof(garden.replaced));garden.vertex_count=0;
    garden_mesh_t mesh={calloc(WORLD_LIMIT,sizeof(garden_vertex_t)),0,WORLD_LIMIT};
    if(!mesh.vertices)return;
    vec3 start=golf_game_get_local_player()->ball.start_pos;
    garden.center=start;garden.radius=28;
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
    float radius=fminf(65,fmaxf(36,garden.radius+8));garden.radius=radius;
    for(int i=0;i<10;i++) {
        float a=2*MF_PI*i/10;vec3 p=vec3_add(start,V3(cosf(a)*radius,-6,sinf(a)*radius));
        oval(&mesh,p,V3(16,8+variation(i)*8,14),paint(.48f,.64f,.48f,0),4,10);
        vec3 cloud=vec3_add(start,V3(cosf(a)*radius*.8f,18+variation(i+3)*6,sinf(a)*radius*.8f));
        for(int j=0;j<3;j++)oval(&mesh,vec3_add(cloud,V3((j-1)*3,variation(j+i),0)),V3(4.3f,1.5f+variation(i+j),2.2f),paint(.96f,.95f,.87f,2),4,9);
    }
    garden.world=sg_make_buffer(&(sg_buffer_desc){.data={mesh.vertices,(size_t)mesh.count*sizeof(garden_vertex_t)}});
    garden.vertex_count=(unsigned)mesh.count;free(mesh.vertices);
    if(!garden.effects.id)garden.effects=sg_make_buffer(&(sg_buffer_desc){.size=sizeof(effects),.usage=SG_USAGE_STREAM});
    if(!garden.shadows.id)garden.shadows=sg_make_buffer(&(sg_buffer_desc){.size=sizeof(shadows),.usage=SG_USAGE_STREAM});
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
void golf_garden_draw_feedback(float time) {
    garden.transform=mat4_identity();garden_mesh_t shadow={shadows,0,FX_LIMIT},fx={effects,0,FX_LIMIT};
    golf_game_t *game=golf_game_get();
    for(int i=0;i<game->player_count;i++) {
        golf_player_t *player=&game->players[i];if(!player->connected||player->ball.is_in_hole)continue;
        vec3 p=player->ball.draw_pos;p.y-=player->ball.radius-.004f;
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
