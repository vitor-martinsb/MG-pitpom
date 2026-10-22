#ifndef GOLF_BOT_H
#define GOLF_BOT_H
#include "golf/physics.h"
#include "golf/mechanics.h"
#include "golf/navigation.h"
typedef struct golf_bot_plan { vec3 direction,landing;float power,peak,launch_speed,wait;int candidates,lookahead;bool safe,reused;double cpu_ms,wall_ms; } golf_bot_plan_t;
#define GOLF_BOT_HISTORY 8
typedef struct golf_bot_attempt { vec3 start,end,direction;float power;bool failed; } golf_bot_attempt_t;
typedef struct golf_bot_memory { golf_bot_attempt_t attempts[GOLF_BOT_HISTORY];int count,next,pending_stroke,observed_stroke,stalled;golf_bot_attempt_t pending; } golf_bot_memory_t;
void golf_bot_record(golf_bot_memory_t *,const golf_player_t *,vec3,float);
void golf_bot_observe(golf_bot_memory_t *,const golf_player_t *,const golf_navigation_t *);
golf_bot_plan_t golf_bot_plan_adaptive(golf_physics_world_t *,const golf_mechanics_t *,const golf_navigation_t *,const golf_player_t *,int,const golf_bot_memory_t *);
golf_bot_plan_t golf_bot_plan(golf_physics_world_t *,const golf_mechanics_t *,const golf_navigation_t *,const golf_player_t *,int difficulty);
void golf_bot_prepare(golf_physics_world_t *,const golf_mechanics_t *,const golf_navigation_t *);
#endif
