#include "golf/mechanics.h"
#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <float.h>
#include <string.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static void settle(golf_wildlife_t *w,golf_player_t *p,int count,float t){golf_wildlife_tick(w,p,count,t,917,true);}
static void rocks(void){
 golf_level_t level={0};assert(headless_level_load(&level,"tests/fixtures/irregular-rock.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t w={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};golf_physics_build_world(&w,false);
 golf_entity_t *stone=NULL;for(int i=0;i<level.entities.length;i++)if(!strcmp(level.entities.data[i].name,"bank-shot-stone"))stone=&level.entities.data[i];assert(stone);
 assert(stone->geo.geo.faces.length>12);vec3 min=V3(FLT_MAX,FLT_MAX,FLT_MAX),max=V3(-FLT_MAX,-FLT_MAX,-FLT_MAX);
 for(int i=0;i<stone->geo.geo.points.length;i++){vec3 p=stone->geo.geo.points.data[i].position;min=V3(fminf(min.x,p.x),fminf(min.y,p.y),fminf(min.z,p.z));max=V3(fmaxf(max.x,p.x),fmaxf(max.y,p.y),fmaxf(max.z,p.z));}
 const float powers[]={0,.45f,1};
 for(int power=0;power<3;power++){
  golf_player_t p;golf_player_init(&p,1,"Rock",V4(1,1,1,1),0);golf_player_start_level(&p,V3(min.x-.45f,min.y+GOLF_BALL_RADIUS,(min.z+max.z)/2));
  assert(golf_physics_shoot(&w,&p,V3(1,0,0),powers[power]));bool struck=false;
  for(int tick=0;tick<360;tick++){
   w.time+=1.f/120;golf_physics_tick_player(&w,&p,1.f/120);assert(isfinite(p.ball.pos.x)&&isfinite(p.ball.pos.y)&&isfinite(p.ball.pos.z));
   if(p.ball.pos.x>min.x-.3f&&(p.ball.vel.x<-.1f||p.ball.pos.y>min.y+GOLF_BALL_RADIUS+.12f))struck=true;
   assert(!(p.ball.pos.x>max.x+.12f&&p.ball.pos.y<min.y+.18f&&fabsf(p.ball.pos.z-(min.z+max.z)/2)<.08f));
   if(!p.ball.is_moving)break;
  }
  assert(struck);
 }
}
int main(void){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,"data/levels/level-11.level"));
 golf_bvh_t fixed;golf_bvh_init(&fixed);golf_physics_world_t world={.level=&level,.static_bvh=&fixed};golf_physics_build_world(&world,false);
 golf_mechanics_t mechanics;golf_mechanics_init(&mechanics,&level,&fixed);golf_wildlife_t w=mechanics.wildlife;
 assert(w.animals[0].active);w.animals[1].active=w.animals[2].active=false;w.portal_count=w.wind_count=0;
 vec3 spot=w.animals[0].pos;w.animals[0].a=w.animals[0].b=spot;
 golf_player_t p[3];for(int i=0;i<3;i++){golf_player_init(&p[i],i+1,"Puddle",V4(1,1,1,1),0);golf_player_start_level(&p[i],vec3_add(spot,V3(0,.12f,0)));}
 p[0].stroke_count=1;p[0].ball.is_moving=true;p[0].ball.vel=V3(4,0,0);golf_wildlife_shot(&w,&p[0]);settle(&w,p,3,20);
 assert(w.accepted_shots==1&&w.puddles[0].active&&w.puddles[0].remaining==3);assert(vec3_length(p[0].ball.vel)<3);
 w.animals[0].active=false;p[0].ball.is_moving=false;settle(&w,p,3,2000);assert(w.puddles[0].remaining==3);
 for(int i=0;i<3;i++){p[i].stroke_count++;p[i].ball.is_moving=true;golf_wildlife_shot(&w,&p[i]);golf_wildlife_shot(&w,&p[i]);}
 assert(w.accepted_shots==4);p[1].ball.is_moving=false;settle(&w,p,3,2001);assert(w.puddles[0].remaining==2);
 settle(&w,p,3,2100);assert(w.puddles[0].remaining==2);
 p[0].ball.is_moving=false;settle(&w,p,3,2101);assert(w.puddles[0].remaining==1&&w.puddles[0].active);
 // A later completed stroke cannot replace the pending third global stroke.
 p[1].stroke_count++;golf_wildlife_shot(&w,&p[1]);settle(&w,p,3,2102);assert(w.puddles[0].remaining==1);
 p[2].ball.is_moving=false;settle(&w,p,3,2103);assert(!w.puddles[0].active);
 for(int i=0;i<3;i++)assert(p[i].ball.slow_until==0);
 // Two independent puddles, with different creation sequences.
 w.puddles[0]=(golf_puddle_t){spot,100,w.accepted_shots,3,true};
 p[0].stroke_count++;golf_wildlife_shot(&w,&p[0]);settle(&w,p,3,2104);assert(w.puddles[0].remaining==2);
 w.puddles[1]=(golf_puddle_t){spot,101,w.accepted_shots,3,true};
 for(int i=0;i<2;i++){p[0].stroke_count++;golf_wildlife_shot(&w,&p[0]);settle(&w,p,3,2105+i);}
 assert(!w.puddles[0].active&&w.puddles[1].active&&w.puddles[1].remaining==1);
 p[0].stroke_count++;golf_wildlife_shot(&w,&p[0]);settle(&w,p,3,2108);assert(!w.puddles[1].active);
 // Distance, rather than a free-running clock, drives the walking pose.
 w=mechanics.wildlife;float travelled=0;vec3 before=w.animals[0].pos;
 for(int tick=0;tick<1440;tick++){
  float old=w.animals[0].stride;settle(&w,NULL,0,tick/120.f);golf_wild_animal_t *a=&w.animals[0];
  float distance=vec3_distance(before,a->pos);travelled+=distance;before=a->pos;
  if(!a->walking)assert(fabsf(a->stride-old)<.00001f);
 }
 assert(travelled>.5f);assert(fabsf(w.animals[0].stride-travelled*(2*MF_PI/.42f))<.015f);
 // Luna and Frida share the same movement contract, including a real stop.
 for(int kind=1;kind<3;kind++){
  w=mechanics.wildlife;assert(w.animals[kind].active);float distance=0;bool rested=false;
  for(int tick=0;tick<2400;tick++){
   vec3 old_pos=w.animals[kind].pos;float old_phase=w.animals[kind].stride;
   settle(&w,NULL,0,tick/120.f);golf_wild_animal_t *a=&w.animals[kind];
   distance+=vec3_distance(old_pos,a->pos);
   if(vec3_distance(old_pos,a->pos)==0){rested=true;assert(a->stride==old_phase);}
  }
  assert(distance>.5f&&rested);assert(fabsf(w.animals[kind].stride-distance*(2*MF_PI/.42f))<.025f);
 }
 golf_mechanics_init(&mechanics,&level,&fixed);assert(mechanics.wildlife.accepted_shots==0);for(int i=0;i<GOLF_PUDDLES;i++)assert(!mechanics.wildlife.puddles[i].active);
 puts("Puddles: exactly three completed valid global shots, duplicates, concurrency, no timer, independent expiry, cleanup and distance-driven gait passed.");
 rocks();puts("Irregular rock: shared render/collision hull, finite response and no tunnelling at low, medium and maximum shot power passed.");
 return 0;
}
