#include "golf/mechanics.h"
#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static void make(golf_player_t *p,int id,vec3 pos){golf_player_init(p,id,"Juju",V4(1,1,1,1),0);golf_player_start_level(p,pos);}
int main(int argc,char **argv){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t world={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};golf_physics_build_world(&world,false);
 golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);assert(m.wildlife.animals[GOLF_JUJU].active);
 if(argc>1){
  for(int seed=1;seed<=32;seed++){
   golf_mechanics_t resident=m;golf_mechanics_seed(&resident,seed,-1);
   golf_wild_animal_t *a=&resident.wildlife.animals[GOLF_JUJU];
   assert(a->active&&golf_wildlife_safe(&resident.wildlife,a->pos,.44f));
   assert(vec3_distance(a->pos,m.start)>1.24f&&vec3_distance(a->pos,m.hole)>1.49f&&vec3_distance(a->pos,m.dog)>1.24f);
   float distance=0;for(int tick=0;tick<200;tick++){
    vec3 before=a->pos;golf_mechanics_tick(&resident,NULL,0,tick/10.f);
    assert(a->active&&golf_wildlife_safe(&resident.wildlife,a->pos,.44f));
    assert(vec3_distance(a->pos,m.start)>1.24f&&vec3_distance(a->pos,m.hole)>1.49f&&vec3_distance(a->pos,m.dog)>1.24f);
    distance+=vec3_distance(before,a->pos);
   }
   assert(vec3_distance(a->a,a->b)>.1f&&distance>.5f);
   if(resident.third_kind==GOLF_JUJU){assert(resident.wildlife.next_mud_print>0);int prints=0;
    for(int j=0;j<GOLF_MUD_PRINTS;j++)if(resident.wildlife.mud_prints[j].active){prints++;assert(golf_wildlife_safe(&resident.wildlife,resident.wildlife.mud_prints[j].pos,.20f));}
    assert(prints>0&&prints<=GOLF_MUD_PRINTS);
   }else assert(resident.wildlife.next_mud_print==0);
  }
  printf("Juju safe permanent walking placement and pawprints: %s\n",argv[1]);return 0;
 }
 bool found=false;for(int seed=1;seed<64;seed++){golf_mechanics_seed(&m,seed,-1);if(m.third_kind==GOLF_JUJU){found=true;break;}}assert(found);
 golf_wildlife_t w=m.wildlife;w.wind_count=w.portal_count=0;
 for(int j=0;j<GOLF_WILDLIFE_COUNT;j++)w.animals[j].active=w.animals[j].present=j==GOLF_JUJU;
 golf_wild_animal_t *a=&w.animals[GOLF_JUJU];a->presence=1;a->a=a->b=a->pos;vec3 spot=a->pos;
 golf_player_t players[50];for(int i=0;i<50;i++){make(&players[i],i+1,vec3_add(spot,V3(0,GOLF_BALL_RADIUS,0)));players[i].stroke_count=1;players[i].ball.is_moving=true;players[i].ball.vel=V3(0,0,-3);golf_wildlife_shot(&w,&players[i]);}
 golf_wildlife_tick(&w,players,50,10,917,true);
 for(int i=0;i<50;i++){golf_ball_t *b=&players[i].ball;assert(b->mud_shots==3&&b->mud_born_stroke==1&&b->effect_kind==GOLF_EFFECT_JUJU&&b->effect_serial==1);assert(fabsf(b->vel.x)>.5f&&b->vel.z<0&&vec3_length(b->vel)<3);assert(!b->capture_until&&!b->slow_shots);}
 assert(a->action==4&&a->action_time==10&&!a->walking);
 // One continuous contact cannot repeatedly slap, even after its cooldown.
 golf_wildlife_tick(&w,players,50,100,917,true);for(int i=0;i<50;i++)assert(players[i].ball.effect_serial==1);
 for(int j=0;j<GOLF_WILDLIFE_COUNT;j++)w.animals[j].active=false;
 vec3 tee=vec3_add(m.start,V3(0,GOLF_BALL_RADIUS,0));
 for(int i=0;i<50;i++){players[i].ball.pos=tee;players[i].ball.is_moving=false;players[i].ball.vel=V3(0,0,0);}
 golf_wildlife_tick(&w,players,50,10000,917,true);assert(players[0].ball.mud_shots==3);
 golf_player_t clean;make(&clean,99,tee);assert(golf_physics_shoot(&world,&clean,V3(0,0,-1),.1f));float normal=vec3_length(clean.ball.vel);
 for(int remaining=3;remaining>0;remaining--){
  golf_player_t *p=&players[0];assert(!golf_physics_shoot(&world,p,V3(0,0,-1),-1));assert(p->ball.mud_shots==remaining);
  assert(golf_physics_shoot(&world,p,V3(0,0,-1),.1f));assert(fabsf(vec3_length(p->ball.vel)-normal*GOLF_MUD_SPEED)<.001f);
  golf_wildlife_shot(&w,p);golf_wildlife_shot(&w,p);golf_wildlife_tick(&w,players,50,10001,917,true);assert(p->ball.mud_shots==remaining);
  p->ball.is_moving=false;golf_wildlife_tick(&w,players,50,10002,917,true);assert(p->ball.mud_shots==remaining-1);
  golf_wildlife_tick(&w,players,50,10003,917,true);assert(p->ball.mud_shots==remaining-1&&players[1].ball.mud_shots==3);
 }
 // Trail contacts apply once and use the same three completed personal shots.
 memset(w.shots,0,sizeof(w.shots));
 golf_player_t trail;make(&trail,88,tee);trail.stroke_count=1;trail.ball.vel=V3(0,0,-3);trail.ball.is_moving=true;
 w.mud_prints[0]=(golf_mud_print_t){m.start,V3(0,0,1),10004,1,true};
 golf_wildlife_tick(&w,&trail,1,10004,917,false);assert(!trail.ball.mud_shots);
 golf_wildlife_tick(&w,&trail,1,10004,917,true);
 assert(trail.ball.mud_shots==3&&trail.ball.effect_kind==GOLF_EFFECT_JUJU&&trail.ball.effect_serial==1&&fabsf(trail.ball.vel.x)>.5f);
 for(int tick=1;tick<1200;tick++)golf_wildlife_tick(&w,&trail,1,10004+tick/120.f,917,true);
 assert(trail.ball.effect_serial==1&&trail.ball.mud_shots==3);
 for(int remaining=3;remaining;remaining--){trail.stroke_count++;trail.ball.is_moving=false;golf_wildlife_shot(&w,&trail);golf_wildlife_tick(&w,&trail,1,10014,917,true);assert(trail.ball.mud_shots==remaining-1);}
 golf_wildlife_tick(&w,&trail,1,10015,917,true);assert(!trail.ball.mud_shots&&trail.ball.effect_serial==1);
 golf_wildlife_tick(&w,&trail,1,10029,917,true);assert(!w.mud_prints[0].active);
 assert(players[0].ball.mud_fade_until>10002);assert(golf_physics_shoot(&world,&players[0],V3(0,0,-1),.1f));assert(fabsf(vec3_length(players[0].ball.vel)-normal)<.001f);
 // Compare distance and lateral deviation using the actual floor and solver.
 for(int power=0;power<3;power++){
  golf_player_t balls[2];float distance[2];
  for(int dirty=0;dirty<2;dirty++){
   make(&balls[dirty],77,tee);balls[dirty].ball.mud_shots=dirty?3:0;world.time=0;
   assert(golf_physics_shoot(&world,&balls[dirty],V3(0,0,-1),power*.1f));
   for(int tick=0;tick<2400&&balls[dirty].ball.is_moving;tick++){
    world.time+=1.f/120;golf_physics_tick_player(&world,&balls[dirty],1.f/120);golf_wildlife_tick(&w,&balls[dirty],1,world.time,917,true);
    assert(isfinite(balls[dirty].ball.pos.x)&&isfinite(balls[dirty].ball.pos.y)&&!balls[dirty].ball.is_out_of_bounds);
   }
   distance[dirty]=vec3_distance(tee,balls[dirty].ball.pos);
  }
  float ratio=distance[1]/distance[0];printf("Mud power %.1f: distance ratio %.4f\n",power*.1f,ratio);assert(ratio>=.65f&&ratio<=.80f);
  assert(fabsf(balls[1].ball.pos.x-tee.x)>.00001f&&fabsf(balls[1].ball.pos.x-tee.x)<.15f);
 }
 golf_player_start_level(&players[1],tee);assert(!players[1].ball.mud_shots&&!players[1].ball.mud_fade_until);
 puts("Juju: selection, resting pose, deterministic slap, fifty independent balls, three completed valid personal shots, no timer/duplicates, 18% speed reduction, 20-35% distance reduction, bounded lateral roll, cleanup passed.");return 0;
}
