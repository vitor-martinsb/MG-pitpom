#include "common/bvh.h"
#undef NDEBUG
#include <assert.h>
#include <float.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void reference(bool enabled){
#ifdef _WIN32
    _putenv_s("GOLF_BVH_FULL_FACES",enabled?"1":"");
#else
    if(enabled)setenv("GOLF_BVH_FULL_FACES","1",1);else unsetenv("GOLF_BVH_FULL_FACES");
#endif
}
static bool same_vec(vec3 a,vec3 b){return a.x==b.x&&a.y==b.y&&a.z==b.z;}
static bool same_contact(golf_ball_contact_t a,golf_ball_contact_t b){
    return a.is_ignored==b.is_ignored&&a.is_water==b.is_water&&a.is_out_of_bounds==b.is_out_of_bounds&&a.type==b.type&&
        same_vec(a.position,b.position)&&same_vec(a.normal,b.normal)&&same_vec(a.velocity,b.velocity)&&
        same_vec(a.v0,b.v0)&&same_vec(a.v1,b.v1)&&same_vec(a.triangle_normal,b.triangle_normal)&&
        same_vec(a.impulse,b.impulse)&&same_vec(a.water_dir,b.water_dir)&&
        same_vec(a.triangle_a,b.triangle_a)&&same_vec(a.triangle_b,b.triangle_b)&&same_vec(a.triangle_c,b.triangle_c)&&
        a.distance==b.distance&&a.penetration==b.penetration&&a.impulse_mag==b.impulse_mag&&a.cull_dot==b.cull_dot&&
        a.restitution==b.restitution&&a.friction==b.friction&&a.vel_scale==b.vel_scale;
}
int main(void){
    golf_level_t level={0};golf_entity_t entity={0};entity.type=GEO_ENTITY;entity.parent_idx=-1;
    golf_bvh_t fast,full;golf_bvh_init(&fast);golf_bvh_init(&full);
    /* Coincident faces cross range boundaries. Their distinct materials expose
     * changed ray ties and contact order, including capped contact buffers. */
    // More than 256 overlapping candidates also exercises the bounded-stack
    // query's full-scan fallback without changing material/contact ordering.
    for(int i=0;i<1024;i++){
        float x=(i%2)*2;golf_bvh_face_t f={0};f.level=&level;f.entity=&entity;
        f.a=V3(x,0,-1);f.b=V3(x+1,0,1);f.c=V3(x+2,0,-1);f.friction=i*.001f;f.restitution=i*.002f;f.vel_scale=1;
        vec_push(&fast.faces,f);vec_push(&full.faces,f);
    }
    golf_bvh_node_info_t info={0};info.face_count=1024;info.idx=7;info.aabb=(golf_bvh_aabb_t){V3(0,0,-1),V3(32,0,1)};
    vec_push(&fast.node_infos,info);vec_push(&full.node_infos,info);
    reference(false);golf_bvh_construct(&fast,fast.node_infos);
    reference(true);golf_bvh_construct(&full,full.node_infos);reference(false);
    assert(fast.nodes.length>full.nodes.length);
    for(int i=-4;i<260;i++)for(int j=-2;j<5;j++){
        vec3 p=V3(i*.125f,j*.075f,.125f);
        for(int cap=1;cap<=16;cap*=2){
            golf_ball_contact_t a[16]={0},b[16]={0};int na=0,nb=0;
            bool ah=golf_bvh_ball_test(&fast,p,.3f,V3(0,0,0),a,&na,cap),bh=golf_bvh_ball_test(&full,p,.3f,V3(0,0,0),b,&nb,cap);
            assert(ah==bh&&na==nb);for(int k=0;k<na;k++)assert(same_contact(a[k],b[k]));
        }
        float a=FLT_MAX,b=FLT_MAX;int ia=-1,ib=-1;golf_bvh_face_t fa={0},fb={0};
        bool ah=golf_bvh_ray_test(&fast,vec3_add(p,V3(0,1,0)),V3(0,-1,0),&a,&ia,&fa),bh=golf_bvh_ray_test(&full,vec3_add(p,V3(0,1,0)),V3(0,-1,0),&b,&ib,&fb);
        assert(ah==bh);if(ah){assert(a==b&&ia==ib);assert(fa.friction==fb.friction&&fa.restitution==fb.restitution);}
    }
    puts("Face range pruning preserves ordered/capped contacts and first-face ray ties.");
    return 0;
}
