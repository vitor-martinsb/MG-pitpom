#ifndef GOLF_PHYSICS_H
#define GOLF_PHYSICS_H

#include "common/bvh.h"
#include "golf/player.h"

#define MAX_NUM_CONTACTS 8

/* The world is updated once per tick; balls never enter its collision tree. */
typedef struct golf_physics_world {
    golf_level_t *level;
    golf_config_t *config;
    golf_bvh_t *static_bvh, *dynamic_bvh;
    float time;
    bool multiplayer;
    float funnel_radius, funnel_force, capture_radius, capture_max_speed;
    void (*sound)(const char *name, const char *path, float volume, bool loop, bool restart);
    void (*stop_sound)(const char *name, float fade);
    void (*ripple)(vec3 position);
    void (*contacts)(vec3 position, golf_ball_contact_t *contacts, int count);
} golf_physics_world_t;

void golf_physics_build_world(golf_physics_world_t *world, bool dynamic);
void golf_physics_tick_player(golf_physics_world_t *world, golf_player_t *player, float dt);
bool golf_physics_shoot(golf_physics_world_t *world, golf_player_t *player, vec3 direction, float power);

#endif
