#include "golf/mechanics.h"
#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
int main(int argc,char **argv){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t world={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};golf_physics_build_world(&world,false);
 golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);assert(m.wildlife.animals[GOLF_MEG].active);
 bool selected=false;
 for(int seed=1;seed<=64;seed++){
  golf_mechanics_seed(&m,seed,-1);golf_wild_animal_t *meg=&m.wildlife.animals[GOLF_MEG];
  assert(golf_wildlife_safe(&m.wildlife,meg->pos,.44f));assert(vec3_distance(meg->a,meg->b)<.001f);
  if(m.third_kind==GOLF_MEG){selected=true;assert(meg->present);break;}
 }
 assert(selected);if(argc>1){printf("Meg safe seated placement: %s\n",argv[1]);return 0;}
 golf_wildlife_t w=m.wildlife;w.wind_count=w.portal_count=0;
 for(int k=0;k<GOLF_WILDLIFE_COUNT;k++)w.animals[k].active=w.animals[k].present=k==GOLF_MEG;
 golf_wild_animal_t *meg=&w.animals[GOLF_MEG];meg->presence=1;vec3 ground=vec3_add(meg->pos,V3(0,GOLF_BALL_RADIUS,0));
 golf_player_t players[50];
 for(int i=0;i<50;i++){golf_player_init(&players[i],i+1,"Meg",V4(1,.5f,.2f,1),0);golf_player_start_level(&players[i],ground);players[i].stroke_count=20;players[i].ball.is_moving=true;players[i].ball.vel=V3(20,0,0);}
 golf_wildlife_tick(&w,players,50,1,917,true);
 for(int i=0;i<50;i++)assert(players[i].ball.capture_kind==GOLF_CAPTURE_MEG&&players[i].ball.captured&&vec3_length(players[i].ball.vel)==0);
 for(int tick=1;tick<=1200;tick++){float time=1+tick/120.f;golf_wildlife_tick(&w,players,50,time,917,true);for(int i=0;i<50;i++)golf_physics_tick_player(&world,&players[i],1.f/120);}
 golf_wildlife_tick(&w,players,50,10000000,917,true);
 for(int i=0;i<50;i++){assert(players[i].ball.captured&&players[i].ball.capture_kind==GOLF_CAPTURE_MEG);assert(vec3_distance(players[i].ball.pos,golf_meg_mouth(&w))<.0001f);assert(players[i].stroke_count==20);}
 assert(!golf_physics_shoot(&world,&players[0],V3(1,0,0),1));
 golf_ball_t other=players[1].ball;
 assert(golf_meg_release(&w,&players[0],&config,10000000,917));
 assert(!memcmp(&other,&players[1].ball,sizeof(other)));assert(players[0].stroke_count==20);
 assert(!players[0].ball.captured&&!players[0].ball.capture_until&&players[0].ball.is_moving);
 assert(fabsf(vec3_length(players[0].ball.vel)-golf_physics_max_shot_speed(&config))<.0001f);
 assert(!golf_meg_release(&w,&players[0],&config,10000000,917));
 // Protection is checked on real contact, while another player's hold remains.
 players[0].ball.pos=players[0].ball.draw_pos=ground;
 golf_wildlife_tick(&w,players,50,10000000.5f,917,true);assert(!players[0].ball.captured);
 players[0].connected=false;players[0].ball.capture_kind=GOLF_CAPTURE_MEG;players[0].ball.captured=true;
 assert(!golf_meg_release(&w,&players[0],&config,10000001,917));players[0].connected=true;
 bool bins[16]={0};
 for(int trial=0;trial<96;trial++){
  players[0].ball.capture_kind=GOLF_CAPTURE_MEG;players[0].ball.captured=true;players[0].ball.mud_shots=3;
  assert(golf_meg_release(&w,&players[0],&config,20+trial,917));
  vec3 v=players[0].ball.vel;assert(fabsf(vec3_length(v)-golf_physics_max_shot_speed(&config))<.0001f);
  int bin=(int)((atan2f(v.z,v.x)+MF_PI)/(2*MF_PI)*16);bins[bin%16]=true;assert(players[0].stroke_count==20);
 }
 int covered=0;for(int i=0;i<16;i++)covered+=bins[i];assert(covered>=12);
 // Release resumes the actual shared physics instead of teleporting to rest.
 float height=players[0].ball.pos.y;golf_physics_tick_player(&world,&players[0],1.f/120);assert(players[0].ball.pos.y<height);
 // The same release and physics path is used by an offline player.
 world.multiplayer=false;players[0].ball.capture_kind=GOLF_CAPTURE_MEG;players[0].ball.captured=true;
 assert(golf_meg_release(&w,&players[0],&config,200,917));assert(players[0].stroke_count==20);
 assert(meg->action==MEG_RELEASING);golf_wildlife_tick(&w,NULL,0,200.1f,917,true);assert(meg->action==MEG_RELEASING);
 golf_wildlife_tick(&w,NULL,0,200.3f,917,true);assert(meg->action==MEG_COOLDOWN);
 golf_wildlife_tick(&w,NULL,0,202,917,true);assert(meg->action==MEG_IDLE);
 players[0].ball.pos=players[0].ball.draw_pos=ground;players[0].ball.wildlife_contact=0;
 golf_wildlife_tick(&w,players,1,202,917,true);assert(players[0].ball.capture_kind==GOLF_CAPTURE_MEG);
 puts("Meg: 50 independent indefinite holds, manual-only release, max force, 360-degree independent directions, unchanged strokes, recapture protection and resumed gravity passed.");
 return 0;
}
