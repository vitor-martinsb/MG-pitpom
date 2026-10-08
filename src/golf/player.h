#ifndef _GOLF_PLAYER_H
#define _GOLF_PLAYER_H

#include <stdint.h>

#include "common/maths.h"

#define GOLF_MAX_PLAYERS 50
#define GOLF_PLAYER_NAME_SIZE 32
#define GOLF_BALL_RADIUS 0.12f

/* All simulation and interpolation state belongs to an individual ball. */
typedef struct golf_ball {
    vec3 start_pos, pos, vel, draw_pos, rot_vec;
    quat orientation;
    float time_since_water_ripple, time_going_slow, time_out_of_bounds, radius, rot_vel,
          time_out_of_water, time_since_impact_sound;
    bool is_moving, is_in_hole, is_in_water, is_out_of_bounds;
} golf_ball_t;

typedef struct golf_player {
    uint32_t id;
    char name[GOLF_PLAYER_NAME_SIZE];
    vec4 color;
    int avatar_id;
    int stroke_count;
    bool connected;
    golf_ball_t ball;
} golf_player_t;

void golf_player_init(golf_player_t *player, uint32_t id, const char *name,
        vec4 color, int avatar_id);
/* Reset hole state without changing player identity or cosmetics. */
void golf_player_start_level(golf_player_t *player, vec3 start_pos);

/* Fixture lifecycle for the offline renderer: one local player or five test players. */
bool golf_players_set_debug_test(golf_player_t players[GOLF_MAX_PLAYERS],
        int *player_count, uint32_t local_id, vec3 spawn, bool enabled);

#endif
