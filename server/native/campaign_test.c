#include "golf/mechanics.h"
#include "golf/physics.h"
#include "bot.h"
#undef NDEBUG
#include <assert.h>
#include <float.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static void player(golf_player_t *p,int id,vec3 position) {
    golf_player_init(p,id,"Campaign",V4(.2f,.35f,.7f,1),0);
    golf_player_start_level(p,position);p->stroke_count=1;
}
static void validate_effect(golf_wildlife_t original,int kind,golf_physics_world_t *world) {
    golf_wildlife_t w=original;
    for(int i=0;i<3;i++)w.animals[i].active=i==kind;
    w.wind_count=w.portal_count=0;w.time=20;
    golf_wild_animal_t *a=&w.animals[kind];a->action_time=20;
    golf_player_t p[2];player(&p[0],1,vec3_add(a->pos,V3(0,GOLF_BALL_RADIUS,0)));
    player(&p[1],2,vec3_add(w.spawn,V3(0,GOLF_BALL_RADIUS,0)));
    p[0].ball.vel=V3(4,0,0);p[0].ball.is_moving=true;
    vec3 other=p[1].ball.pos;vec4 color=p[0].color;
    golf_wildlife_tick(&w,p,2,20,1234,true);
    assert(p[0].ball.effect_kind==kind+1&&p[0].ball.effect_serial==1);
    assert(p[1].ball.effect_serial==0&&p[1].ball.slow_until==0&&p[1].ball.capture_until==0);
    assert(vec3_distance(other,p[1].ball.pos)<.0001f);
    assert(p[0].color.x==color.x&&p[0].color.y==color.y&&p[0].color.z==color.z);
    if(kind==0) {
        assert(p[0].ball.slow_until>20&&vec3_length(p[0].ball.vel)<3);
        assert(w.puddles[0].active&&w.puddles[0].remaining==3);
        for(int i=1;i<500;i++) {
            p[0].ball.pos=vec3_add(a->pos,V3(0,GOLF_BALL_RADIUS,0));
            golf_wildlife_tick(&w,p,1,20+i/120.f,1234,true);
        }
        assert(p[0].ball.effect_serial==1);
        p[0].ball.is_moving=false;world->time=25;
        assert(golf_physics_shoot(world,&p[0],V3(1,0,0),.2f));
        assert(fabsf(vec3_length(p[0].ball.vel)-5)<.001f);
    }else {
        assert(p[0].ball.captured&&p[0].ball.capture_until>20);
        assert(!golf_physics_shoot(world,&p[0],V3(1,0,0),.2f));
        vec3 destination=p[0].ball.capture_target;
        if(kind==1)assert(vec3_distance(destination,vec3_add(w.spawn,V3(0,GOLF_BALL_RADIUS,0)))<.001f);
        else {
            assert(vec3_distance(destination,p[0].ball.pos)>1.9f);
            assert(golf_wildlife_safe(&w,vec3_sub(destination,V3(0,GOLF_BALL_RADIUS,0)),.24f));
        }
        golf_wildlife_tick(&w,p,2,21.3f,1234,true);
        assert(!p[0].ball.capture_until&&!p[0].ball.captured&&!p[0].ball.is_moving);
        assert(vec3_distance(p[0].ball.pos,destination)<.001f);
        assert(p[0].ball.wildlife_protection>23&&p[0].ball.collision_grace>0);
        assert(p[0].stroke_count==1&&p[1].stroke_count==1);
    }
}
int main(int argc,char **argv) {
    assert(argc>=2);headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,argv[1]));
    golf_config_t config={0};golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);
    golf_physics_world_t world={0};world.level=&level;world.config=&config;world.static_bvh=&fixed;world.dynamic_bvh=&moving;world.multiplayer=true;
    world.funnel_radius=CFG_NUM(&config,"multiplayer_funnel_radius");world.funnel_force=CFG_NUM(&config,"multiplayer_funnel_force");world.capture_radius=CFG_NUM(&config,"multiplayer_capture_radius");world.capture_max_speed=CFG_NUM(&config,"multiplayer_capture_max_speed");
    golf_physics_build_world(&world,false);golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);m.enabled=true;
    assert(m.wildlife.course>=1&&m.wildlife.course<=100&&m.wildlife.world>=1&&m.wildlife.world<=10);
    const golf_navigation_t *nav=golf_mechanics_navigation();assert(nav->count>0);
    int requested=0;for(int i=0;i<level.entities.length;i++)if(!strncmp(level.entities.data[i].name,"animal:",7))requested++;
    int active=0;for(int i=0;i<3;i++)if(m.wildlife.animals[i].active){active++;validate_effect(m.wildlife,i,&world);}
    assert(active==requested);
    // Fifty balls receive independent state, including simultaneous captures.
    for(int kind=0;kind<3;kind++)if(m.wildlife.animals[kind].active) {
        golf_wildlife_t w=m.wildlife;w.wind_count=w.portal_count=0;w.time=30;
        for(int j=0;j<3;j++)w.animals[j].active=j==kind;
        w.animals[kind].action_time=30;
        golf_wildlife_t replay=w;
        golf_player_t balls[50];
        for(int j=0;j<50;j++)player(&balls[j],j+1,vec3_add(w.animals[kind].pos,V3(0,GOLF_BALL_RADIUS,0)));
        golf_wildlife_tick(&w,balls,50,30,917,true);
        vec3 first_target=balls[0].ball.capture_target;
        for(int j=0;j<50;j++)assert(balls[j].ball.effect_serial==1&&balls[j].ball.effect_kind==kind+1);
        golf_wildlife_tick(&w,balls,50,31.5f,917,true);
        for(int j=0;j<50;j++)assert(!balls[j].ball.captured&&balls[j].stroke_count==1);
        if(kind==2) {
            golf_player_t again;player(&again,1,vec3_add(replay.animals[kind].pos,V3(0,GOLF_BALL_RADIUS,0)));
            golf_wildlife_tick(&replay,&again,1,30,917,true);
            assert(vec3_distance(again.ball.capture_target,first_target)<.001f);
        }
    }
    for(int j=0;j<m.wildlife.portal_count;j++) {
        golf_wildlife_t w=m.wildlife;w.time=40;for(int a=0;a<3;a++)w.animals[a].active=false;
        assert(w.portals[j].active);golf_player_t ball;player(&ball,1,vec3_add(w.portals[j].pos,V3(0,GOLF_BALL_RADIUS,0)));
        ball.ball.is_moving=true;golf_wildlife_tick(&w,&ball,1,40,917,true);
        assert(ball.ball.capture_kind==4);vec3 target=ball.ball.capture_target;
        golf_wildlife_tick(&w,&ball,1,40.5f,917,true);
        assert(!ball.ball.captured&&vec3_distance(ball.ball.pos,target)<.001f);
        assert(golf_wildlife_safe(&w,vec3_sub(target,V3(0,GOLF_BALL_RADIUS,0)),.24f));
    }
    for(int j=0;j<m.wildlife.wind_count;j++) {
        golf_wildlife_t w=m.wildlife;w.time=50;w.portal_count=0;for(int a=0;a<3;a++)w.animals[a].active=false;
        golf_player_t ball;player(&ball,1,w.wind[j].pos);ball.ball.is_moving=true;
        ball.ball.vel=V3(0,0,-1);golf_wildlife_tick(&w,&ball,1,50,917,true);
        assert(fabsf(ball.ball.vel.x)>.00001f);
    }
    // The loop is physical geometry, not a cosmetic ring: a real shot climbs
    // above its centre while low-speed players can use the connected green.
    for(int j=0;j<level.entities.length;j++)if(!strcmp(level.entities.data[j].name,"vertical-loop")) {
        golf_geo_t *geo=&level.entities.data[j].geo.geo;
        vec3 origin=vec3_scale(vec3_add(geo->points.data[0].position,geo->points.data[1].position),.5f);
        float top=0;for(int k=0;k<geo->points.length;k++)top=fmaxf(top,geo->points.data[k].position.y);
        float apex=0;bool completed=false;
        for(int attempt=0;attempt<4;attempt++) {
            golf_player_t ball;player(&ball,1,vec3_add(origin,V3(0,GOLF_BALL_RADIUS,0)));world.time=0;
            assert(golf_physics_shoot(&world,&ball,V3(2.2f/(MF_PI*top),0,-1),.35f+attempt*.18f));
            bool over_top=false;
            for(int k=0;k<180;k++){
                world.time+=1.f/120;golf_physics_tick_player(&world,&ball,1.f/120);apex=fmaxf(apex,ball.ball.pos.y);
                if(ball.ball.pos.y>top*.8f)over_top=true;
                vec3 d=vec3_sub(ball.ball.pos,origin);
                if(over_top&&fabsf(d.y)<.4f&&fabsf(d.z)<.8f&&d.x>1.4f&&d.x<3.5f)completed=true;
            }
        }
        if(apex<top*.8f)fprintf(stderr,"Loop apex %.3f, top %.3f\n",apex,top);
        assert(apex>top*.8f);
        assert(completed);
    }
    for(int tick=0;tick<2400;tick++) {
        float t=tick/120.f;golf_wildlife_tick(&m.wildlife,NULL,0,t,1234,true);
        for(int kind=0;kind<3;kind++)if(m.wildlife.animals[kind].active)
            assert(golf_wildlife_safe(&m.wildlife,m.wildlife.animals[kind].pos,.44f));
    }
    // Real shots, real C collision response, no teleporting or fixture positions.
    // Animals are disabled only for the geometry witness; isolation/safety above
    // exercises their effects separately without relying on a lucky random hit.
    m.enabled=false;m.impact=false;golf_player_t p;golf_player_init(&p,1,"Witness",V4(1,1,1,1),0);
    golf_player_start_level(&p,vec3_add(m.start,V3(0,GOLF_BALL_RADIUS,0)));world.time=0;
    golf_bot_memory_t memory={0};
    for(int stroke=0;stroke<90&&!p.ball.is_in_hole;stroke++) {
        golf_bot_observe(&memory,&p,nav);
        golf_bot_plan_t plan=golf_bot_plan_adaptive(&world,&m,nav,&p,2,&memory);
        if(argc>2){vec3 target=golf_nav_target(nav,p.ball.pos);fprintf(stderr,"shot %d at %.3f %.3f %.3f target %.3f %.3f %.3f direction %.3f %.3f power %.4f cost %.3f\n",stroke,p.ball.pos.x,p.ball.pos.y,p.ball.pos.z,target.x,target.y,target.z,plan.direction.x,plan.direction.z,plan.power,golf_nav_cost(nav,p.ball.pos));}
        assert(golf_physics_shoot(&world,&p,plan.direction,plan.power));
        golf_bot_record(&memory,&p,plan.direction,plan.power);
        for(int tick=0;tick<1800&&!p.ball.is_in_hole;tick++) {
            world.time+=1.f/120;golf_physics_build_world(&world,true);
            golf_physics_tick_player(&world,&p,1.f/120);golf_mechanics_tick(&m,&p,1,world.time);
            assert(isfinite(p.ball.pos.x)&&isfinite(p.ball.pos.y)&&isfinite(p.ball.pos.z));
            if(p.ball.is_out_of_bounds&&(!p.ball.is_moving||p.ball.pos.y<-10))golf_ball_return_before_shot(&p);
            if(!p.ball.is_moving&&!p.ball.capture_until)break;
        }
        if(p.ball.is_moving&&!p.ball.is_in_hole)golf_ball_return_before_shot(&p);
    }
    if(!p.ball.is_in_hole)fprintf(stderr,"Campaign witness failed: %s, pos %.3f %.3f %.3f, hole %.3f %.3f %.3f, cost %.3f\n",argv[1],p.ball.pos.x,p.ball.pos.y,p.ball.pos.z,m.hole.x,m.hole.y,m.hole.z,golf_nav_cost(nav,p.ball.pos));
    assert(p.ball.is_in_hole);
    printf("Campaign %d: %d real shots; %d animals validated, safe patrols and individual effects.\n",m.wildlife.course,p.stroke_count,active);
    return 0;
}
