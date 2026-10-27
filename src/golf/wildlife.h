#ifndef GOLF_WILDLIFE_H
#define GOLF_WILDLIFE_H
#include "golf/navigation.h"
#include "golf/player.h"
#define GOLF_WILDLIFE_COUNT 4
#define GOLF_JUJU 3
#define GOLF_EFFECT_JUJU 6
#define GOLF_WIND_ZONES 8
#define GOLF_PORTALS 8
#define GOLF_PUDDLES 128
#define GOLF_MUD_PRINTS 48
#define GOLF_MUD_PRINT_LIFETIME 24.f
#define GOLF_MUD_PRINT_STEP .28f
#define GOLF_MUD_PRINT_CLEARANCE .20f
typedef struct golf_wild_animal {
    bool active, walking, present;
    vec3 a,b,pos,forward;
    float clock,action_time,stride,speed,gait,presence,patrol_period;
    int action;
} golf_wild_animal_t;
typedef struct golf_wind_zone { vec3 pos,size,direction; float strength,period,phase; bool mill; } golf_wind_zone_t;
typedef struct golf_portal { vec3 pos; int pair,end; bool active; } golf_portal_t;
typedef struct golf_puddle {vec3 pos;uint32_t id,born;int remaining;bool active;} golf_puddle_t;
typedef struct golf_mud_print {vec3 pos,forward;float born;uint32_t id;bool active;} golf_mud_print_t;
typedef struct golf_wild_shot {uint32_t player,sequence;int stroke;bool pending;} golf_wild_shot_t;
typedef struct golf_wildlife {
    golf_wild_animal_t animals[GOLF_WILDLIFE_COUNT];
    golf_wind_zone_t wind[GOLF_WIND_ZONES]; int wind_count;
    golf_portal_t portals[GOLF_PORTALS]; int portal_count;
    golf_puddle_t puddles[GOLF_PUDDLES];uint32_t accepted_shots,next_puddle;
    golf_mud_print_t mud_prints[GOLF_MUD_PRINTS];uint32_t next_mud_print;float print_distance;
    golf_wild_shot_t shots[GOLF_MAX_PLAYERS];
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
vec3 golf_wildlife_wind(const golf_wildlife_t *,vec3,float);
float golf_wind_gust(const golf_wind_zone_t *,float);
void golf_wildlife_shot(golf_wildlife_t *,const golf_player_t *);
#endif
