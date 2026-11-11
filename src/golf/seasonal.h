#ifndef GOLF_SEASONAL_H
#define GOLF_SEASONAL_H
#include "golf/navigation.h"
#include "golf/player.h"
#include "golf/wildlife.h"
#define GOLF_SEASON_ITEMS 12
enum {SEASON_GIFT,SEASON_SNOWMAN,SEASON_PORTAL,SEASON_CANDY,SEASON_SLEIGH,SEASON_SNOWBALL,SEASON_STAR,SEASON_ICE};
typedef struct golf_season_item {int kind;vec3 pos;float phase,action_time;} golf_season_item_t;
typedef struct golf_season {bool enabled;int count;golf_season_item_t items[GOLF_SEASON_ITEMS];uint32_t ids[GOLF_MAX_PLAYERS];float cooldown[GOLF_MAX_PLAYERS][GOLF_SEASON_ITEMS];} golf_season_t;
void golf_season_prepare(golf_season_t *,const golf_navigation_t *,uint32_t,bool,vec3,const golf_wildlife_t *);
vec3 golf_season_position(const golf_season_item_t *,float);
void golf_season_tick(golf_season_t *,golf_player_t *,int,float);
#endif
