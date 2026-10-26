#include "golf/mechanics.h"
#include "golf/physics.h"
#include "bot.h"
#include "golf/progress.h"
#include "parson/parson.h"
#undef NDEBUG
#include <assert.h>
#include <float.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static void player(golf_player_t *p,int id,vec3 position) {
    golf_player_init(p,id,"Campaign",V4(.2f,.35f,.7f,1),0);
    golf_player_start_level(p,position);p->stroke_count=1;
}
static void validate_bridge(golf_physics_world_t *world){
    int samples=0;
    for(int i=0;i<world->static_bvh->faces.length;i++){
        golf_bvh_face_t *f=&world->static_bvh->faces.data[i];
        if(!f->entity||strcmp(f->entity->name,"evolution-bridge"))continue;
        vec3 normal=vec3_normalize(vec3_cross(vec3_sub(f->b,f->a),vec3_sub(f->c,f->a)));
        if(normal.y<.7f)continue;
        vec3 center=vec3_scale(vec3_add(vec3_add(f->a,f->b),f->c),1.f/3);
        for(int side=-1;side<=1;side+=2){
            golf_player_t p;golf_player_init(&p,91,"Bridge",V4(1,1,1,1),0);
            golf_player_start_level(&p,vec3_add(center,V3(0,GOLF_BALL_RADIUS+.005f,0)));
            golf_physics_world_t w=*world;w.time=0;
            vec3 start=p.ball.pos;
            assert(golf_physics_shoot(&w,&p,V3(0,0,(float)side),.18f));
            for(int tick=0;tick<12;tick++){
                w.time+=1.f/120;golf_physics_tick_player(&w,&p,1.f/120);
                assert(isfinite(p.ball.pos.x)&&isfinite(p.ball.pos.y)&&isfinite(p.ball.pos.z));
            }
            if((p.ball.pos.z-start.z)*side<.08f)fprintf(stderr,"Bridge stops ball at %.3f %.3f %.3f, side %d, velocity scale %.3f\n",center.x,center.y,center.z,side,f->vel_scale);
            assert((p.ball.pos.z-start.z)*side>.08f);
            assert(p.stroke_count==1&&!p.ball.is_out_of_bounds);
            samples++;
        }
    }
    if(samples)printf("Bridge: %d ramp/deck rolling samples in both directions passed.\n",samples);
}
static void validate_environment(golf_physics_world_t *world,const golf_mechanics_t *m){
    // Real transport: never pin the probe back into the water between ticks.
    for(int i=0;i<world->level->entities.length;i++){
        golf_entity_t *entry=&world->level->entities.data[i];
        if(strncmp(entry->name,"stream-entry:",13))continue;
        char name[128];snprintf(name,sizeof(name),"stream-outlet:%s",entry->name+13);
        golf_entity_t *outlet=NULL;
        for(int j=0;j<world->level->entities.length;j++)if(!strcmp(world->level->entities.data[j].name,name))outlet=&world->level->entities.data[j];
        assert(outlet);
        vec3 from=golf_entity_get_world_transform(world->level,entry).position;
        vec3 to=golf_entity_get_world_transform(world->level,outlet).position;
        golf_player_t p;player(&p,92,vec3_add(from,V3(0,.06f,0)));p.ball.is_moving=true;
        golf_physics_world_t w=*world;w.time=0;int wet=0;float closest=FLT_MAX;
        for(int tick=0;tick<1200;tick++){
            w.time+=1.f/120;golf_physics_tick_player(&w,&p,1.f/120);
            wet+=p.ball.is_in_water;
            if(getenv("GOLF_TRACE_STREAM")&&tick%30==0)fprintf(stderr,"%s tick %d wet %d pos %.3f %.3f %.3f vel %.3f %.3f %.3f\n",entry->name,tick,p.ball.is_in_water,p.ball.pos.x,p.ball.pos.y,p.ball.pos.z,p.ball.vel.x,p.ball.vel.y,p.ball.vel.z);
            float distance=hypotf(p.ball.pos.x-to.x,p.ball.pos.z-to.z);closest=fminf(closest,distance);
            if(wet>=6&&distance<.45f)break;
            if(p.ball.is_out_of_bounds||p.ball.pos.y<from.y-.3f)break;
        }
        if(wet<6||closest>=.45f)fprintf(stderr,"Current transport %s: wet %d closest %.3f final %.3f %.3f %.3f outlet %.3f %.3f %.3f\n",entry->name,wet,closest,p.ball.pos.x,p.ball.pos.y,p.ball.pos.z,to.x,to.y,to.z);
        assert(wet>=6&&closest<.45f);
        assert(p.ball.pos.y>from.y-.3f&&p.stroke_count==1);
    }
    for(int i=0;i<m->wildlife.wind_count;i++){
        const golf_wind_zone_t *z=&m->wildlife.wind[i];if(!z->mill)continue;
        float peak=z->period>0?(MF_PI*.5f-z->phase)*z->period/(2*MF_PI):0;
        while(peak<0)peak+=z->period;
        const golf_navigation_t *nav=golf_mechanics_navigation();float best=0;vec3 start=V3(0,0,0);
        golf_wildlife_t wind=m->wildlife;wind.wind_count=1;wind.wind[0]=*z;
        for(int j=0;j<nav->count;j++){
            vec3 p=vec3_add(nav->nodes[j].pos,V3(0,GOLF_BALL_RADIUS,0));
            // A ball can cross water or jump between graph components.
            // Sample every verified floor, not just the walking component.
            if(vec3_distance(p,m->start)<1.5f)continue;
            float force=vec3_length(golf_wildlife_wind(&wind,p,peak));
            if(force>best){best=force;start=p;}
        }
        golf_player_t p;player(&p,93,start);golf_physics_world_t w=*world;w.time=peak;
        wind.time=peak;
        for(int tick=0;tick<120;tick++){
            w.time+=1.f/120;golf_physics_tick_player(&w,&p,1.f/120);golf_wildlife_tick(&wind,&p,1,w.time,1,false);
        }
        vec3 delta=vec3_sub(p.ball.pos,start);delta.y=0;
        if(vec3_dot(delta,z->direction)<.2f)fprintf(stderr,"Wind transport course %d: force %.3f displacement %.3f %.3f\n",m->wildlife.course,best,delta.x,delta.z);
        assert(vec3_dot(delta,z->direction)>.2f);
        assert(p.stroke_count==1&&!p.ball.is_in_hole);
    }
}
static void validate_effect(golf_wildlife_t original,int kind,golf_physics_world_t *world) {
    golf_wildlife_t w=original;
    for(int i=0;i<3;i++)w.animals[i].active=w.animals[i].present=i==kind;
    w.wind_count=w.portal_count=0;w.time=20;
    golf_wild_animal_t *a=&w.animals[kind];a->action_time=20;a->presence=1;
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
        assert(fabsf(vec3_length(p[0].ball.vel)-3.25f)<.001f);
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
    validate_bridge(&world);
    validate_environment(&world,&m);
    // All three members are present from loading through long idle periods.
    // Repeated seeding here represents separate fields, never a live respawn.
    assert(m.cat_valid&&m.dog_valid);
    for(int kind=0;kind<3;kind++)assert(m.wildlife.animals[kind].active);
    bool chosen[GOLF_WILDLIFE_COUNT]={false};int previous=-1;
    for(uint32_t seed=1;seed<=32;seed++){
        golf_mechanics_t resident=m;golf_mechanics_seed(&resident,seed,previous);
        const int selected=resident.third_kind;
        assert(selected!=previous);chosen[selected]=true;previous=selected;
        assert(golf_wildlife_safe(&resident.wildlife,resident.dog,.72f));
        for(int t=0;t<=3600;t+=37){
            golf_mechanics_animate(&resident,(float)t);
            assert(resident.third_kind==selected);
            assert(resident.cat_present&&resident.dog_present);
            assert(resident.cat_presence==1&&resident.dog_presence==1);
            int visible=2;
            for(int k=0;k<GOLF_WILDLIFE_COUNT;k++){
                const golf_wild_animal_t *a=&resident.wildlife.animals[k];
                assert(a->present==(k==selected));
                if(a->present){assert(a->presence==1);visible++;}
            }
            assert(visible==3);
            assert(vec3_distance(resident.cat,resident.dog)>=1.3f);
            golf_wild_animal_t *pet=&resident.wildlife.animals[selected];
            for(int sample=0;sample<=20;sample++){
                vec3 pos=vec3_add(pet->a,vec3_scale(vec3_sub(pet->b,pet->a),sample/20.f));
                assert(vec3_distance(resident.cat,pos)>=1.19f);
                assert(vec3_distance(resident.dog,pos)>=1.24f);
            }
        }
    }
    assert(chosen[0]&&chosen[1]&&chosen[2]&&chosen[3]);
    // Existing twenty-course records must survive the interleaved catalogue.
    JSON_Value *saved=json_parse_string("{\"stroke_count_level_0\":2,\"stroke_count_level_1\":3,\"stroke_count_level_19\":7,\"pitpom100_best_1\":1}");
    const int old_courses[]={0,4,76},old_scores[]={2,3,7};char key[64];
    for(int i=0;i<3;i++){golf_progress_key(key,sizeof(key),&config,old_courses[i]);assert(json_object_get_number(json_value_get_object(saved),key)==old_scores[i]);}
    golf_progress_key(key,sizeof(key),&config,1);assert(json_object_get_value(json_value_get_object(saved),key)==NULL);json_value_free(saved);
    // Verify every added stream is exposed physical water, with the original
    // drag/current and ordinary out-of-bounds recovery, rather than blue paint.
    for(int e=0;e<level.entities.length;e++)if(!strncmp(level.entities.data[e].name,"evolution-stream-",17)){
        bool exposed=false;
        for(int f=0;f<fixed.faces.length&&!exposed;f++){
            golf_bvh_face_t *face=&fixed.faces.data[f];if(face->entity!=&level.entities.data[e])continue;
            vec3 center=vec3_scale(vec3_add(vec3_add(face->a,face->b),face->c),1.f/3);
            golf_bvh_face_t top;float distance=FLT_MAX;int index;
            vec3 sky=V3(center.x,m.bounds_max.y+3,center.z);
            if(!golf_bvh_ray_test(&fixed,sky,V3(0,-1,0),&distance,&index,&top)||top.entity!=face->entity)continue;
            golf_player_t wet;player(&wet,90,vec3_add(center,V3(0,.06f,0)));wet.ball.start_pos=vec3_add(m.start,V3(0,GOLF_BALL_RADIUS,0));wet.ball.vel=V3(.5f,0,0);wet.ball.is_moving=true;
            bool contacted=false;world.time=0;
            for(int tick=0;tick<1800;tick++){
                world.time+=1.f/120;golf_physics_tick_player(&world,&wet,1.f/120);contacted|=wet.ball.is_in_water;
                assert(isfinite(wet.ball.pos.x)&&isfinite(wet.ball.pos.y)&&isfinite(wet.ball.pos.z));
                if(wet.ball.is_out_of_bounds){golf_ball_return_before_shot(&wet);break;}
                if(!wet.ball.is_moving)break;
            }
            if(wet.ball.is_moving)fprintf(stderr,"Stream never settles %s p %.3f %.3f %.3f v %.3f %.3f %.3f\n",face->entity->name,wet.ball.pos.x,wet.ball.pos.y,wet.ball.pos.z,wet.ball.vel.x,wet.ball.vel.y,wet.ball.vel.z);
            assert(contacted);assert(!wet.ball.is_moving);exposed=true;
        }
        if(!exposed){
            int faces=0;
            for(int f=0;f<fixed.faces.length;f++)if(fixed.faces.data[f].entity==&level.entities.data[e]){
                golf_bvh_face_t *face=&fixed.faces.data[f];vec3 center=vec3_scale(vec3_add(vec3_add(face->a,face->b),face->c),1.f/3);
                golf_bvh_face_t top={0};float distance=FLT_MAX;int index;
                golf_bvh_ray_test(&fixed,vec3_add(center,V3(0,.15f,0)),V3(0,-1,0),&distance,&index,&top);
                fprintf(stderr,"Covered stream %s %.3f %.3f %.3f top %s t%.4f\n",face->entity->name,center.x,center.y,center.z,top.entity?top.entity->name:"none",distance);faces++;
            }
            fprintf(stderr,"Stream faces %d\n",faces);
        }
        assert(exposed);
    }
    world.time=0;
    assert(m.wildlife.course>=1&&m.wildlife.course<=80&&m.wildlife.world>=1&&m.wildlife.world<=10);
    const golf_navigation_t *nav=golf_mechanics_navigation();assert(nav->count>0);
    int requested=0;for(int i=0;i<level.entities.length;i++)if(!strncmp(level.entities.data[i].name,"animal:",7))requested++;
    int active=0;for(int i=0;i<3;i++)if(m.wildlife.animals[i].active){active++;validate_effect(m.wildlife,i,&world);}
    assert(active<=3&&(!requested||active<=requested));
    // Fifty balls receive independent state, including simultaneous captures.
    for(int kind=0;kind<3;kind++)if(m.wildlife.animals[kind].active) {
        golf_wildlife_t w=m.wildlife;w.wind_count=w.portal_count=0;w.time=30;
        for(int j=0;j<3;j++)w.animals[j].active=w.animals[j].present=j==kind;
        w.animals[kind].action_time=30;w.animals[kind].presence=1;
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
        golf_player_t ball;player(&ball,1,vec3_add(w.wind[j].pos,vec3_scale(w.wind[j].direction,.5f)));ball.ball.is_moving=true;
        vec3 expected=golf_wildlife_wind(&w,ball.ball.pos,50);
        ball.ball.vel=V3(0,0,-1);golf_wildlife_tick(&w,&ball,1,50,917,true);
        assert(vec3_length(vec3_sub(ball.ball.vel,V3(0,0,-1)))>.00001f);
        assert(vec3_distance(ball.ball.vel,vec3_add(V3(0,0,-1),vec3_scale(expected,1.f/120)))<.00001f);
        if(w.wind[j].mill){
            assert(vec3_dot(expected,w.wind[j].direction)>0);
            assert(vec3_length(golf_wildlife_wind(&w,vec3_add(w.wind[j].pos,V3(100,0,100)),50))==0);
            assert(vec3_length(golf_wildlife_wind(&w,w.hole,50))==0);
        }
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
        for(int kind=0;kind<3;kind++)if(m.wildlife.animals[kind].active){
            golf_wild_animal_t *a=&m.wildlife.animals[kind];
            if(!golf_wildlife_safe(&m.wildlife,a->pos,.44f))fprintf(stderr,"Unsafe patrol %d t%.3f p %.3f %.3f %.3f a %.3f %.3f %.3f b %.3f %.3f %.3f\n",kind,t,a->pos.x,a->pos.y,a->pos.z,a->a.x,a->a.y,a->a.z,a->b.x,a->b.y,a->b.z);
            assert(golf_wildlife_safe(&m.wildlife,a->pos,.44f));
        }
    }
    // Real shots, real C collision response, no teleporting or fixture positions.
    // Animals are disabled only for the geometry witness; isolation/safety above
    // exercises their effects separately without relying on a lucky random hit.
    m.enabled=false;m.impact=false;golf_player_t p;golf_player_init(&p,1,"Witness",V4(1,1,1,1),0);
    golf_player_start_level(&p,vec3_add(m.start,V3(0,GOLF_BALL_RADIUS,0)));world.time=0;
    golf_bot_memory_t memory={0};
    // Every registered campaign test must finish within the real room limit.
    bool solve=argc>2&&!strcmp(argv[2],"--solve");
    for(int stroke=0;stroke<(solve?90:4)&&!p.ball.is_in_hole;stroke++) {
        golf_bot_observe(&memory,&p,nav);
        golf_bot_plan_t plan=golf_bot_plan_adaptive(&world,&m,nav,&p,2,&memory);
        for(int idle=0;idle<(int)(plan.wait*120);idle++){
            world.time+=1.f/120;golf_mechanics_tick(&m,NULL,0,world.time);
        }
        if(argc>2){vec3 target=golf_nav_target(nav,p.ball.pos);fprintf(stderr,"shot %d at %.3f %.3f %.3f target %.3f %.3f %.3f direction %.3f %.3f power %.4f cost %.3f launch %.3f\n",stroke,p.ball.pos.x,p.ball.pos.y,p.ball.pos.z,target.x,target.y,target.z,plan.direction.x,plan.direction.z,plan.power,golf_nav_cost(nav,p.ball.pos),plan.launch_speed);}
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
    if(solve&&!p.ball.is_in_hole)fprintf(stderr,"Campaign witness failed: %s, pos %.3f %.3f %.3f, hole %.3f %.3f %.3f, cost %.3f\n",argv[1],p.ball.pos.x,p.ball.pos.y,p.ball.pos.z,m.hole.x,m.hole.y,m.hole.z,golf_nav_cost(nav,p.ball.pos));
    assert(solve?p.ball.is_in_hole:p.stroke_count>0);
    if(solve)assert(p.stroke_count<=48);
    printf("Campaign %d: %d real shots; %d animals validated, safe patrols and individual effects.\n",m.wildlife.course,p.stroke_count,active);
    return 0;
}
