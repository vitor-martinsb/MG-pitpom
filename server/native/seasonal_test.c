#include "golf/mechanics.h"
#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static golf_player_t player(vec3 pos){golf_player_t p;golf_player_init(&p,1,"Santa",V4(1,1,1,1),0);golf_player_start_level(&p,pos);p.stroke_count=1;p.ball.vel=V3(-2,0,0);p.ball.is_moving=true;return p;}
static void ice_friction(void){
 golf_level_t level={0};golf_entity_t ground={0};ground.type=GEO_ENTITY;ground.parent_idx=-1;
 ground.geo.transform.scale=V3(1,1,1);ground.geo.transform.rotation=QUAT(0,0,0,1);
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);
 golf_bvh_face_t f={0};f.level=&level;f.entity=&ground;f.a=V3(-20,5,-20);f.b=V3(0,5,20);f.c=V3(20,5,-20);f.vel_scale=1;f.friction=.6f;
 vec_push(&fixed.faces,f);golf_bvh_node_t n={0};n.is_leaf=true;n.leaf_node_info.face_count=1;n.aabb=(golf_bvh_aabb_t){V3(-20,5,-20),V3(20,5,20)};vec_push(&fixed.nodes,n);fixed.parent=0;
 golf_config_t cfg={0};golf_physics_world_t w={.level=&level,.config=&cfg,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};
 golf_player_t normal=player(V3(0,5.12f,0)),ice=normal,expired=normal;ice.ball.season_ice_until=10;expired.ball.season_ice_until=.5f;
 for(int tick=0;tick<120;tick++){w.time=1+tick/120.f;golf_physics_tick_player(&w,&normal,1.f/120);golf_physics_tick_player(&w,&ice,1.f/120);golf_physics_tick_player(&w,&expired,1.f/120);}
 assert(fabsf(ice.ball.pos.x)>fabsf(normal.ball.pos.x)*1.3f);assert(!memcmp(&normal.ball.pos,&expired.ball.pos,sizeof(vec3)));assert(!memcmp(&normal.ball.vel,&expired.ball.vel,sizeof(vec3)));
 vec_deinit(&fixed.faces);vec_deinit(&fixed.nodes);
}
int main(void){
 ice_friction();
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,"data/levels/level-3.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t cfg={0};
 golf_physics_world_t world={.level=&level,.config=&cfg,.static_bvh=&fixed,.dynamic_bvh=&moving,.multiplayer=true};golf_physics_build_world(&world,false);
 golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);const golf_navigation_t *nav=golf_mechanics_navigation();
 golf_season_t a,b;golf_season_prepare(&a,nav,42,false,m.start,&m.wildlife);assert(!a.enabled&&!a.count);
 golf_season_prepare(&a,nav,42,true,m.start,&m.wildlife);golf_season_prepare(&b,nav,42,true,m.start,&m.wildlife);assert(!memcmp(&a,&b,sizeof(a)));assert(a.count>0&&a.count<=9);
 for(int i=0;i<a.count;i++){assert(vec3_distance(a.items[i].pos,m.start)>=2.5f);assert(vec3_distance(a.items[i].pos,m.hole)>=2.5f);assert(golf_wildlife_safe(&m.wildlife,a.items[i].pos,.6f));}
 vec3 point=m.start;point.y-=.12f;
 for(int kind=SEASON_GIFT;kind<=SEASON_ICE;kind++){
  golf_season_t s={.enabled=true,.count=1,.items={{.kind=kind,.pos=point,.phase=1}}};
  if(kind==SEASON_PORTAL){s.count=2;s.items[1]=(golf_season_item_t){.kind=kind,.pos=vec3_add(point,V3(4,0,0))};}
  golf_player_t p=player(vec3_add(golf_season_position(&s.items[0],1),V3(.04f,.12f,0)));p.ball.radius=.12f;
  golf_ball_t before=p.ball;s.enabled=false;golf_season_tick(&s,&p,1,1);assert(!memcmp(&p.ball,&before,sizeof(before)));s.enabled=true;golf_season_tick(&s,&p,1,1);
  if(kind==SEASON_ICE){assert(p.ball.season_ice_until>1);assert(p.ball.effect_serial==0);golf_player_start_level(&p,m.start);assert(p.ball.season_ice_until==0);}
  else {assert(p.ball.effect_serial==1);if(kind==SEASON_PORTAL){assert(p.ball.captured&&p.ball.capture_kind==4);assert(vec3_distance(p.ball.capture_target,s.items[1].pos)<.2f);
    golf_wildlife_t w=m.wildlife;for(int j=0;j<GOLF_WILDLIFE_COUNT;j++)w.animals[j].active=false;
    vec3 target=p.ball.capture_target;golf_wildlife_tick(&w,&p,1,1.4f,42,false);assert(!p.ball.captured&&p.ball.capture_until==0&&p.ball.capture_kind==0);assert(vec3_distance(p.ball.pos,target)<.001f);}else {assert(isfinite(p.ball.vel.x)&&vec3_length(p.ball.vel)<=12);assert(vec3_distance(before.vel,p.ball.vel)>.01f||vec3_distance(before.pos,p.ball.pos)>.01f);}golf_season_tick(&s,&p,1,1.01f);assert(p.ball.effect_serial==1);}
 }
 golf_season_t s={.enabled=true,.count=1,.items={{.kind=SEASON_STAR,.pos=point}}};golf_player_t crowd[GOLF_MAX_PLAYERS];
 for(int i=0;i<GOLF_MAX_PLAYERS;i++){crowd[i]=player(vec3_add(point,V3(.05f,.12f,0)));crowd[i].id=i+1;}
 golf_season_tick(&s,crowd,GOLF_MAX_PLAYERS,2);for(int i=0;i<GOLF_MAX_PLAYERS;i++)assert(crowd[i].ball.effect_serial==1);
 for(int i=0;i<GOLF_MAX_PLAYERS;i++){crowd[i].id+=100;crowd[i].ball.effect_serial=0;}golf_season_tick(&s,crowd,GOLF_MAX_PLAYERS,3);for(int i=0;i<GOLF_MAX_PLAYERS;i++)assert(crowd[i].ball.effect_serial==1);
 puts("Christmas: deterministic compatible placement, disabled invariance, eight interactions, cooldowns, ice reset and 50 independent players passed.");return 0;
}
