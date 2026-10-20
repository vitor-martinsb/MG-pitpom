#include "golf/mechanics.h"
#include "golf/physics.h"
#include "golf/navigation.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>

void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static void place(golf_player_t *p,int id,vec3 position) {
    golf_player_init(p,id,"Test",V4(1,1,1,1),0);
    golf_player_start_level(p,position);p->stroke_count=2;
}
int main(int argc,char **argv) {
    headless_config_load();golf_level_t level={0};
    assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-1.level"));
    golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);
    golf_config_t config={0};golf_physics_world_t world={0};world.level=&level;world.config=&config;world.static_bvh=&fixed;world.dynamic_bvh=&moving;
    golf_physics_build_world(&world,false);
    golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);m.enabled=true;m.schedule=false;
    assert(m.cat_valid&&m.dog_valid);
    assert(m.cat_span>=.1f&&m.cat_span<=1.25f);
    assert(vec3_distance(m.start,m.cat_center)>1.4f&&vec3_distance(m.hole,m.dog)>1.4f);
    for(int animal=0;animal<2;animal++) {
        vec3 p=animal?m.dog:m.cat_center;
        vec3 floor;assert(golf_nav_floor(&fixed,p,&floor,.72f));
        float t=100;int idx;golf_bvh_face_t face;
        assert(golf_bvh_ray_test(&fixed,vec3_add(p,V3(0,.5f,0)),V3(0,-1,0),&t,&idx,&face));
        assert(fabsf(t-.5f)<.02f);
    }
    for(int i=-10;i<=10;i++){
        vec3 p=vec3_add(m.cat_center,vec3_scale(m.across,m.cat_span*i/10.f)),floor;
        assert(golf_nav_floor(&fixed,p,&floor,.72f));assert(fabsf(floor.y-p.y)<.12f);
    }
    golf_mechanics_animate(&m,2);vec3 a=m.cat;golf_mechanics_animate(&m,6);assert(vec3_distance(a,m.cat)>.05f);
    golf_player_t players[50];
    for(int direction=0;direction<2;direction++) {
        m.forward_probability=direction;
        golf_mechanics_animate(&m,0);place(&players[0],1,vec3_add(m.cat,V3(0,GOLF_BALL_RADIUS,0)));
        golf_mechanics_tick(&m,players,1,0);
        assert(players[0].ball.cat_hits==1);
        float along=vec3_dot(players[0].ball.vel,m.direction);
        assert(direction?along>7:along<-7);assert(players[0].stroke_count==2);
        // Advance cooldown while following the cat: one contact still means one slap.
        for(int i=1;i<500;i++){golf_mechanics_animate(&m,i/120.f);players[0].ball.pos=vec3_add(m.cat,V3(0,GOLF_BALL_RADIUS,0));golf_mechanics_tick(&m,players,1,i/120.f);}
        assert(players[0].ball.cat_hits==1);
    }
    vec3 before=vec3_add(m.start,V3(0,GOLF_BALL_RADIUS,0));
    for(int i=0;i<50;i++){place(&players[i],i+1,before);players[i].stroke_count=7+i;players[i].ball.pos=vec3_add(m.dog,V3(0,GOLF_BALL_RADIUS,0));players[i].ball.orientation=QUAT(.2f,.3f,.4f,.8f);players[i].ball.rot_vel=3;}
    golf_mechanics_tick(&m,players,50,10);
    for(int i=0;i<50;i++){assert(players[i].ball.capture_until>10);assert(!players[i].ball.captured);assert(!golf_physics_shoot(&world,&players[i],V3(1,0,0),.5f));}
    golf_mechanics_tick(&m,players,50,10.5f);for(int i=0;i<50;i++)assert(players[i].ball.captured);
    golf_mechanics_tick(&m,players,50,11.2f);
    for(int i=0;i<50;i++){assert(vec3_distance(players[i].ball.pos,before)<.001f);assert(vec3_length(players[i].ball.vel)==0);assert(players[i].ball.rot_vel==0);assert(!players[i].ball.capture_until&&!players[i].ball.captured);assert(players[i].stroke_count==7+i);assert(players[i].ball.first_shot_complete);}
    for(int i=0;i<50;i++){assert(players[i].ball.orientation.x==0&&players[i].ball.orientation.y==0&&players[i].ball.orientation.z==0&&players[i].ball.orientation.w==1);}
    // A resting first-shot ball is protected until both participants finish.
    place(&players[0],1,V3(0,.12f,0));place(&players[1],2,V3(.2f,.12f,0));
    players[0].ball.vel=V3(6,0,0);players[1].ball.first_shot_complete=true;
    golf_mechanics_impacts(players,2);assert(vec3_length(players[1].ball.vel)==0);
    players[0].ball.first_shot_complete=true;golf_mechanics_impacts(players,2);
    assert(players[1].ball.vel.x>0&&players[0].ball.vel.x<6);assert(players[1].stroke_count==2);
    assert(vec3_distance(players[0].ball.pos,players[1].ball.pos)>=.239f);
    // Newly released overlapping balls separate without gaining an impulse.
    place(&players[0],1,V3(0,.12f,0));place(&players[1],2,V3(.1f,.12f,0));
    players[0].ball.first_shot_complete=players[1].ball.first_shot_complete=true;
    players[0].ball.collision_grace=.25f;players[1].ball.vel=V3(-6,0,0);
    golf_mechanics_impacts(players,2);assert(vec3_length(players[0].ball.vel)==0);
    assert(players[1].ball.vel.x==-6&&vec3_distance(players[0].ball.pos,players[1].ball.pos)>=.239f);
    // Repeatable crowded resolution, bounded velocities, no phantom strokes.
    for(int i=0;i<50;i++){place(&players[i],i+1,V3((i%10)*.08f,.12f,(i/10)*.08f));players[i].ball.first_shot_complete=true;players[i].ball.vel=V3((i%2?1:-1)*8,0,0);}
    for(int step=0;step<120;step++)golf_mechanics_impacts(players,50);
    for(int i=0;i<50;i++){assert(isfinite(players[i].ball.pos.x));assert(vec3_length(players[i].ball.vel)<=12.001f);assert(players[i].stroke_count==2);}
    for(int i=0;i<50;i++)for(int j=i+1;j<50;j++)assert(vec3_distance(players[i].ball.pos,players[j].ball.pos)>.238f);
    puts("Mascots: safe placement, lateral crossing, both slap directions, one contact, simultaneous captures and return; Impact: eligibility, separation, speed and stroke limits passed.");
    return 0;
}
