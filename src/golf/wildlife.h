#ifndef GOLF_WILDLIFE_H
#define GOLF_WILDLIFE_H
#include "golf/navigation.h"
#include "golf/player.h"
#define GOLF_WILDLIFE_COUNT 3
#define GOLF_WIND_ZONES 8
#define GOLF_PORTALS 8
typedef struct golf_wild_animal {
    bool active, walking;
    vec3 a,b,pos,forward;
    float clock,action_time;
    int action;
} golf_wild_animal_t;
typedef struct golf_wind_zone { vec3 pos,size; float strength; } golf_wind_zone_t;
typedef struct golf_portal { vec3 pos; int pair,end; bool active; } golf_portal_t;
typedef struct golf_wildlife {
    golf_wild_animal_t animals[GOLF_WILDLIFE_COUNT];
    golf_wind_zone_t wind[GOLF_WIND_ZONES]; int wind_count;
    golf_portal_t portals[GOLF_PORTALS]; int portal_count;
    int world,stage,course;
    float time;
    vec3 spawn,hole;
    golf_bvh_t *floor;
    const golf_navigation_t *nav;
    golf_bvh_aabb_t excluded[32]; int excluded_count;
} golf_wildlife_t;
void golf_wildlife_init(golf_wildlife_t *,golf_level_t *,golf_bvh_t *,const golf_navigation_t *,vec3,vec3,vec3,vec3,const golf_bvh_aabb_t *,int);
void golf_wildlife_tick(golf_wildlife_t *,golf_player_t *,int,float,uint32_t,bool);
bool golf_wildlife_safe(const golf_wildlife_t *,vec3,float);
#endif
