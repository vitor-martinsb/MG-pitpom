#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>

void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
int main(int argc,char **argv) {
    headless_config_load();
    golf_level_t level={0}; assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
    golf_config_t config={0}; golf_bvh_t fixed,moving; golf_bvh_init(&fixed); golf_bvh_init(&moving);
    golf_physics_world_t world={0}; world.level=&level;world.config=&config;world.static_bvh=&fixed;world.dynamic_bvh=&moving;
    world.multiplayer=true;world.funnel_radius=CFG_NUM(&config,"multiplayer_funnel_radius");world.funnel_force=CFG_NUM(&config,"multiplayer_funnel_force");world.capture_radius=CFG_NUM(&config,"multiplayer_capture_radius");world.capture_max_speed=CFG_NUM(&config,"multiplayer_capture_max_speed");
    golf_physics_build_world(&world,false);
    vec3 hole=V3(0,0,0);
    for(int i=0;i<level.entities.length;i++) if(level.entities.data[i].type==HOLE_ENTITY)hole=level.entities.data[i].hole.transform.position;
    golf_player_t p; golf_player_init(&p,1,"Test",V4(1,1,1,1),0);
    golf_player_start_level(&p,vec3_add(hole,V3(.3f,GOLF_BALL_RADIUS,0)));
    p.ball.is_moving=true;
    float last_y=p.ball.pos.y;bool descended=false;
    for(int i=0;i<1200&&!p.ball.is_in_hole;i++) {
        vec3 previous=p.ball.pos;
        world.time+=1.f/120;golf_physics_build_world(&world,true);golf_physics_tick_player(&world,&p,1.f/120);
        assert(isfinite(p.ball.pos.x)&&isfinite(p.ball.pos.y)&&isfinite(p.ball.pos.z));
        assert(vec3_distance(previous,p.ball.pos)<.08f);
        if(p.ball.pos.y<last_y-.01f)descended=true;
    }
    printf("Hole test: captured=%d position=(%g,%g,%g)\n",p.ball.is_in_hole,p.ball.pos.x,p.ball.pos.y,p.ball.pos.z);
    assert(descended&&p.ball.is_in_hole);
    assert(!p.ball.is_moving);
    assert(!golf_physics_shoot(&world,&p,V3(0,0,-1),.5f));
    golf_player_start_level(&p,vec3_add(hole,V3(.6f,GOLF_BALL_RADIUS,0)));
    p.ball.is_moving=true;p.ball.vel=V3(4,0,0);
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);assert(p.ball.pos.x>hole.x+.6f);
    /* A ball inside the cup, off-center, used to miss the narrow trigger. */
    golf_player_start_level(&p,vec3_add(hole,V3(.24f,-.4f,0)));
    p.ball.is_moving=true;p.ball.vel=V3(0,-1,0);
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(p.ball.is_in_hole);
    vec3 captured=p.ball.pos;
    for(int i=0;i<720;i++)golf_physics_tick_player(&world,&p,1.f/120);
    assert(vec3_equal(p.ball.pos,captured));assert(!p.ball.is_out_of_bounds);
    /* A fast downward step must not skip over the whole capture volume. */
    golf_player_start_level(&p,vec3_add(hole,V3(0,.2f,0)));
    p.ball.is_moving=true;p.ball.vel=V3(0,-180,0);
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(p.ball.is_in_hole);assert(p.ball.pos.y>hole.y-.8f);
    for(int direction=0;direction<8;direction++) {
        float angle=direction*MF_PI/4;
        golf_player_start_level(&p,vec3_add(hole,V3(.3f*cosf(angle),GOLF_BALL_RADIUS,.3f*sinf(angle))));
        p.ball.is_moving=true;
        for(int i=0;i<1200&&!p.ball.is_in_hole;i++) {
            vec3 previous=p.ball.pos;
            golf_physics_tick_player(&world,&p,1.f/120);
            assert(vec3_distance(previous,p.ball.pos)<.08f);
            assert(p.ball.pos.y>hole.y-.8f);
        }
        assert(p.ball.is_in_hole);assert(vec3_length(p.ball.vel)==0);
        captured=p.ball.pos;
        for(int i=0;i<720;i++)golf_physics_tick_player(&world,&p,1.f/120);
        assert(vec3_equal(p.ball.pos,captured));
    }
    golf_player_start_level(&p,vec3_add(hole,V3(0,1,0)));
    p.ball.is_moving=true;
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);
    golf_player_start_level(&p,vec3_add(hole,V3(.36f,-.2f,0)));
    p.ball.is_moving=true;
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);
    golf_level_t empty={0};world.level=&empty;
    golf_player_start_level(&p,V3(0,-.4f,0));p.ball.is_moving=true;
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);
    puts("Cup capture: eight rim directions, off-center descent, swept fast fall, stable finish and no false positives passed.");
    return 0;
}
