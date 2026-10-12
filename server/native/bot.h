#ifndef GOLF_BOT_H
#define GOLF_BOT_H
#include "golf/physics.h"
#include "golf/mechanics.h"
#include "golf/navigation.h"
typedef struct golf_bot_plan { vec3 direction; float power; int candidates; } golf_bot_plan_t;
golf_bot_plan_t golf_bot_plan(golf_physics_world_t *,const golf_mechanics_t *,const golf_navigation_t *,const golf_player_t *,int difficulty);
#endif
