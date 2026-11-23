#include "golf/mechanics.h"
#include "golf/physics.h"
#include "golf/alfredo.h"
#undef NDEBUG
#include <assert.h>
#include <stdio.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
int main(int argc,char **argv){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t world={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};golf_physics_build_world(&world,false);
 golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);golf_mechanics_seed(&m,6,-1);golf_wildlife_t *w=&m.wildlife;golf_companion_t *a=&w->companions.alfredo;
 if(argc>1){if(a->active){assert(golf_wildlife_safe(w,a->pos,.32f));assert(vec3_distance(a->pos,w->spawn)>1.5f);assert(vec3_distance(a->pos,w->hole)>1.2f);}printf("Alfredo placement %s: %s\n",argv[1],a->active?"safe":"no compatible space");return 0;}
 assert(a->active);golf_player_t p;golf_player_init(&p,1,"Alfredo",V4(1,1,1,1),0);golf_player_start_level(&p,w->spawn);p.stroke_count=1;
 p.ball.pos=p.ball.draw_pos=vec3_add(a->pos,V3(0,p.ball.radius,0));p.ball.vel=V3(.05f,0,0);p.ball.is_moving=true;
 golf_player_t idle[GOLF_MAX_PLAYERS]={0};idle[0]=p;idle[0].stroke_count=0;
 golf_alfredo_tick(w,idle,GOLF_MAX_PLAYERS,.5f,723,true);
 assert(a->state==ALFREDO_IDLE&&a->player==0&&a->cooldown==0);
 float time=1;golf_alfredo_tick(w,&p,1,time,723,true);assert(p.ball.capture_kind==GOLF_CAPTURE_ALFREDO);assert(!golf_physics_shoot(&world,&p,V3(1,0,0),1));
 unsigned beats=0;bool up[3]={0},down[3]={0},gravity=false,released=false;float peaks[3]={0},last_vy=0;
 for(int i=0;i<1200;i++){
  time+=1.f/120;world.time=time;int state=a->state;vec3 before=p.ball.pos;last_vy=p.ball.vel.y;
  golf_physics_tick_player(&world,&p,1.f/120);
  if(state==ALFREDO_JUGGLE&&before.y>a->pos.y+.75f){assert(fabsf(p.ball.vel.y-last_vy+GOLF_PHYSICS_GRAVITY/120)<.002f);gravity=true;}
  golf_alfredo_tick(w,&p,1,time,723,true);
  if(a->state==ALFREDO_JUGGLE){
   assert(a->cycles>=1&&a->cycles<=3);beats=a->cycles;int k=(int)beats-1;
   up[k]|=p.ball.vel.y>1;down[k]|=p.ball.vel.y<-.3f;peaks[k]=fmaxf(peaks[k],p.ball.pos.y-a->pos.y);
   assert(fabsf(p.ball.pos.x-a->pos.x)<.0001f&&fabsf(p.ball.pos.z-a->pos.z)<.0001f);
   assert(p.ball.capture_until>0&&!p.ball.captured);assert(!golf_physics_shoot(&world,&p,V3(1,0,0),1));
  }
  if(a->state==ALFREDO_KICK){assert(beats==3&&a->cycles==4);assert(!p.ball.capture_until&&!p.ball.capture_kind&&!p.ball.captured);assert(p.ball.vel.y>3);assert(hypotf(p.ball.vel.x,p.ball.vel.z)>0);released=true;break;}
 }
 assert(gravity&&released);for(int k=0;k<3;k++){assert(up[k]&&down[k]&&peaks[k]>.9f);}assert(p.stroke_count==1);
 vec3 released_at=p.ball.pos;float initial_vy=p.ball.vel.y;bool falling=false,landed=false;float top=released_at.y;
 for(int i=0;i<1200;i++){
  time+=1.f/120;world.time=time;golf_physics_tick_player(&world,&p,1.f/120);golf_alfredo_tick(w,&p,1,time,723,true);
  top=fmaxf(top,p.ball.pos.y);falling|=p.ball.vel.y<-.2f;
  vec3 floor;
  if(falling&&golf_nav_floor(&fixed,p.ball.pos,&floor,0)&&fabsf(p.ball.pos.y-floor.y-p.ball.radius)<.045f){landed=true;break;}
 }
 assert(top>released_at.y+.5f&&initial_vy>0&&falling&&landed);assert(!p.ball.is_out_of_bounds);assert(p.stroke_count==1);
 for(int i=0;i<1200&&a->state!=ALFREDO_COOLDOWN;i++){time+=1.f/120;golf_alfredo_tick(w,&p,1,time,723,true);}
 assert(a->state==ALFREDO_COOLDOWN&&vec3_distance(a->pos,a->home)<.021f);float until=a->cooldown;assert(until>time+4.99f);
 golf_alfredo_tick(w,&p,1,until-.01f,723,true);assert(a->state==ALFREDO_COOLDOWN);golf_alfredo_tick(w,&p,1,until+.01f,723,true);assert(a->state==ALFREDO_IDLE);
 p.ball.is_moving=true;p.ball.pos=vec3_add(a->pos,V3(0,p.ball.radius,0));p.ball.vel=V3(0,0,0);p.ball.wildlife_protection=0;time=until+1;golf_alfredo_tick(w,&p,1,time,723,true);assert(p.ball.capture_kind==9);
 p.connected=false;golf_alfredo_tick(w,&p,1,time+.01f,723,true);assert(!p.ball.capture_until&&!p.ball.capture_kind&&!p.ball.captured);
 printf("Alfredo: exactly three REAL gravity rebounds, fourth 3D kick, safe landing, unchanged strokes, return, 5s cooldown and disconnect unlock passed\n");return 0;
}
