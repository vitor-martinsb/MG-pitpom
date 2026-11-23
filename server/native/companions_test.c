#include "golf/mechanics.h"
#include "golf/physics.h"
#include <float.h>
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static bool close3(vec3 a,vec3 b){return vec3_distance(a,b)<.0002f;}
static void step(golf_wildlife_t *w,golf_player_t *p,float t){golf_companions_tick(w,p,1,t,927,true);}
int main(int argc,char **argv){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t world={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};golf_physics_build_world(&world,false);
 golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);golf_mechanics_seed(&m,6,-1);golf_wildlife_t *w=&m.wildlife;
 golf_companion_t *b=&w->companions.benedita,*s=&w->companions.smanata;
 if(argc>1){
  if(b->active)assert(golf_wildlife_safe(w,b->pos,.30f));
  if(s->active)assert(golf_wildlife_safe(w,s->pos,.30f));
  if(b->active&&s->active)assert(vec3_distance(b->pos,s->pos)>1.3f);
 }else{assert(b->active&&s->active);}
 golf_player_t p;golf_player_init(&p,1,"Companions",V4(1,1,1,1),0);golf_player_start_level(&p,w->spawn);p.stroke_count=1;
 if(argc==1){
  s->active=false;vec3 target;bool found=false;
  for(int i=0;i<w->nav->count;i++){vec3 v=w->nav->nodes[i].pos;float d=vec3_distance(v,b->pos);if(d>.6f&&d<1.8f&&golf_nav_segment(&fixed,b->pos,v,.12f)){target=v;found=true;break;}}
  assert(found);b->forward=vec3_normalize(vec3_sub(target,b->pos));p.ball.pos=p.ball.draw_pos=vec3_add(target,V3(0,p.ball.radius,0));p.ball.vel=V3(2,0,-1);p.ball.rot_vec=V3(1,2,3);p.ball.rot_vel=4.2f;p.ball.is_moving=true;
  vec3 original=p.ball.pos;step(w,&p,1);assert(p.ball.capture_kind==GOLF_CAPTURE_BENEDITA&&p.ball.capture_until==4);
  assert(close3(p.ball.vel,V3(0,0,0))&&p.ball.rot_vel==0&&!p.ball.captured);
  golf_physics_tick_player(&world,&p,1.f/120);assert(close3(original,p.ball.pos));
  step(w,&p,3.99f);assert(p.ball.capture_kind==7);step(w,&p,4.001f);
  assert(!p.ball.capture_until&&close3(p.ball.vel,V3(2,0,-1))&&close3(p.ball.rot_vec,V3(1,2,3))&&p.ball.rot_vel==4.2f&&p.stroke_count==1);
  step(w,&p,8.99f);assert(!p.ball.capture_kind);step(w,&p,9.01f);assert(p.ball.capture_kind==7);step(w,&p,12.02f);assert(!p.ball.capture_kind);
  // A ball behind her and a stationary ball do not activate the gaze.
  b->forward=vec3_scale(b->forward,-1);b->cooldown=0;step(w,&p,13);assert(!p.ball.capture_kind);
  b->forward=vec3_scale(b->forward,-1);p.ball.is_moving=false;step(w,&p,14);assert(!p.ball.capture_kind);
  s->active=true;
 }
 b->active=false;
 if(s->active){
  p.ball.pos=p.ball.draw_pos=vec3_add(s->pos,V3(0,p.ball.radius,0));p.ball.is_moving=true;p.ball.vel=V3(1,0,0);p.ball.wildlife_protection=0;
  step(w,&p,20);assert(p.ball.capture_kind==GOLF_CAPTURE_SMANATA&&p.ball.captured&&p.ball.capture_until==FLT_MAX);
  vec3 previous=s->pos;float time=20;
  for(int k=0;k<2400&&s->state!=SMANATA_HOLDING;k++){
   time+=1.f/120;step(w,&p,time);
   assert(golf_wildlife_safe(w,s->pos,.30f));assert(golf_nav_segment(&fixed,previous,s->pos,.30f));previous=s->pos;
   assert(close3(p.ball.pos,golf_smanata_mouth(s,false))&&close3(p.ball.vel,V3(0,0,0))&&p.stroke_count==1);
  }
  assert(s->state==SMANATA_HOLDING);
  vec3 stopped=s->pos;step(w,&p,time+100);assert(p.ball.captured&&s->state==SMANATA_HOLDING&&close3(stopped,s->pos));time+=100;
  golf_player_t wrong=p;wrong.id=2;assert(!golf_smanata_release(w,&wrong,time));
  assert(golf_smanata_release(w,&p,time));assert(!golf_smanata_release(w,&p,time));
  assert(!p.ball.captured&&!p.ball.capture_kind&&!p.ball.capture_until&&!p.ball.is_moving&&close3(p.ball.vel,V3(0,0,0)));
  assert(fabsf(p.ball.pos.y-stopped.y-p.ball.radius)<.0002f&&p.stroke_count==1);
  assert(golf_physics_shoot(&world,&p,V3(1,0,0),.1f)&&p.stroke_count==2);
  // Do not let the next test shot alter her independent return trajectory.
  p.ball.is_in_hole=true;
  for(int k=0;k<3000&&s->state!=SMANATA_COOLDOWN;k++){time+=1.f/120;step(w,&p,time);assert(golf_wildlife_safe(w,s->pos,.30f));}
  if(s->state!=SMANATA_COOLDOWN||!close3(s->pos,s->home))fprintf(stderr,"return stuck: state=%d pos=%g,%g,%g home=%g,%g,%g path=%d/%d goal=%g,%g,%g\n",s->state,s->pos.x,s->pos.y,s->pos.z,s->home.x,s->home.y,s->home.z,w->companions.path_index,w->companions.path_count,w->companions.goal.x,w->companions.goal.y,w->companions.goal.z);
  assert(s->state==SMANATA_COOLDOWN&&close3(s->pos,s->home)&&s->cooldown>time+4.99f);
  step(w,&p,s->cooldown-.01f);assert(s->state==SMANATA_COOLDOWN);step(w,&p,s->cooldown+.01f);assert(s->state==SMANATA_IDLE);
 }
 if(argc==1){
  // Capture beats the gaze, and restores neither a duplicate ball nor momentum.
  p.ball.is_in_hole=false;p.ball.is_moving=true;p.ball.pos=vec3_add(s->home,V3(0,p.ball.radius,0));p.ball.capture_kind=GOLF_CAPTURE_BENEDITA;p.ball.capture_until=1000;p.ball.captured=false;
  b->active=true;b->state=1;b->player=p.id;b->until=1000;s->cooldown=0;
  step(w,&p,200);assert(p.ball.capture_kind==GOLF_CAPTURE_SMANATA&&!b->state&&b->cooldown==205);
  // A disconnect never leaves a captured ball or companion stranded.
  p.connected=false;step(w,&p,201);assert(p.ball.capture_kind==0&&s->state==SMANATA_RETURNING);
 }
 printf("Benedita/Smanata: %s: freeze/restore, priority, carry, safe route, manual drop, next shot and return passed\n",argc>1?argv[1]:"mechanics");return 0;
}
