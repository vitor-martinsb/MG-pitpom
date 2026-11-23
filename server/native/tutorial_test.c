#include "golf/mechanics.h"
#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <stdio.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
int main(void){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,"data/tutorial/practice.level"));
 assert(level.entities.length==11);vec3 start=V3(0,0,2.5f);
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t world={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=false};golf_physics_build_world(&world,false);
 golf_player_t p;bool won=false;int winning_power=0;
 for(int power=10;power<=100&&!won;power+=2){
  golf_player_init(&p,1,"Practice",V4(1,1,1,1),0);golf_player_start_level(&p,vec3_add(start,V3(0,p.ball.radius,0)));assert(golf_physics_shoot(&world,&p,V3(0,0,-1),power/100.f));
  for(int i=0;i<3600&&!p.ball.is_in_hole;i++){world.time+=1.f/120;golf_physics_tick_player(&world,&p,1.f/120);assert(!p.ball.is_in_water&&!p.ball.is_out_of_bounds);if(!p.ball.is_moving)break;}
  won=p.ball.is_in_hole;if(won)winning_power=power;
 }
 assert(won&&p.stroke_count==1);
 golf_player_start_level(&p,vec3_add(start,V3(0,p.ball.radius,0)));assert(golf_physics_shoot(&world,&p,V3(1,0,0),.45f));bool rebound=false;
 for(int i=0;i<240;i++){world.time+=1.f/120;golf_physics_tick_player(&world,&p,1.f/120);rebound|=p.ball.vel.x<-.1f;assert(!p.ball.is_out_of_bounds);}
 assert(rebound);printf("Tutorial: real cup and border collision using shared physics passed (winning power %d%%)\n",winning_power);return 0;
}
