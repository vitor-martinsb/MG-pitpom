#include <stdio.h>

#include "golf/player.h"

/* Keep checks active in Release builds too. */
#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "Failed: %s (line %d)\n", #condition, __LINE__); \
        return 1; \
    } \
} while (0)

int main(void) {
    golf_player_t players[GOLF_MAX_PLAYERS];
    for (int i = 0; i < GOLF_MAX_PLAYERS; i++) {
        golf_player_init(&players[i], (uint32_t)(i + 1), "Player",
                V4(0.2f, 0.4f, 0.8f, 1), i % 8);
        golf_player_start_level(&players[i], V3(1, GOLF_BALL_RADIUS, -3));
        players[i].stroke_count = i + 1;
        players[i].ball.vel = V3(i + 1, 0, 0);
        players[i].ball.is_moving = true;
    }

    /* Retrying one hole must not change the other 49 players. */
    golf_player_t others[GOLF_MAX_PLAYERS - 1];
    memcpy(others, &players[1], sizeof(others));
    golf_player_t *local = &players[0];
    local->ball.is_in_water = true;
    local->ball.is_in_hole = true;
    local->ball.is_out_of_bounds = true;
    local->ball.rot_vel = 5;
    local->ball.time_going_slow = 0.6f;
    local->ball.time_out_of_water = 0;
    local->ball.time_since_impact_sound = 0.05f;
    local->ball.time_since_water_ripple = 0.02f;
    local->ball.orientation = QUAT(1, 0, 0, 0);
    local->connected = false;

    vec3 spawn = V3(2, GOLF_BALL_RADIUS, -5);
    golf_player_start_level(local, spawn);
    CHECK(memcmp(others, &players[1], sizeof(others)) == 0);
    CHECK(local->id == 1 && strcmp(local->name, "Player") == 0);
    CHECK(local->avatar_id == 0 && !local->connected);
    CHECK(local->color.x == 0.2f && local->color.z == 0.8f);
    CHECK(local->stroke_count == 0);
    CHECK(vec3_equal(local->ball.pos, spawn));
    CHECK(vec3_equal(local->ball.start_pos, spawn));
    CHECK(vec3_equal(local->ball.draw_pos, spawn));
    CHECK(vec3_length_squared(local->ball.vel) == 0);
    CHECK(vec3_length_squared(local->ball.rot_vec) == 0);
    CHECK(local->ball.orientation.w == 1 && local->ball.orientation.x == 0);
    CHECK(local->ball.radius == GOLF_BALL_RADIUS && local->ball.rot_vel == 0);
    CHECK(!local->ball.is_moving && !local->ball.is_in_hole);
    CHECK(!local->ball.is_in_water && !local->ball.is_out_of_bounds);
    CHECK(local->ball.time_out_of_bounds == -1 && local->ball.time_going_slow == 0);
    CHECK(local->ball.time_out_of_water == 1);
    CHECK(local->ball.time_since_impact_sound == 0);
    CHECK(local->ball.time_since_water_ripple == 0);

    golf_player_init(local, 73,
            "This nickname is longer than the available name buffer",
            V4(1, 1, 1, 1), 4);
    CHECK(strlen(local->name) == GOLF_PLAYER_NAME_SIZE - 1);
    CHECK(local->name[GOLF_PLAYER_NAME_SIZE - 1] == '\0');
    CHECK(local->id == 73 && local->connected && local->avatar_id == 4);
    golf_player_init(local, 91, NULL, V4(1, 1, 1, 1), 0);
    CHECK(strcmp(local->name, "Player") == 0);

    /* Adding/removing visual fixtures must preserve an in-flight local ball. */
    int player_count = 1;
    golf_player_init(local, 3, "Local", V4(0.3f, 0.4f, 0.5f, 1), 7);
    local->stroke_count = 8;
    local->ball.pos = V3(5, 6, 7);
    local->ball.draw_pos = V3(4, 5, 6);
    local->ball.vel = V3(2, 3, 4);
    local->ball.is_moving = true;
    golf_player_t saved_local = *local;
    for (int cycle = 0; cycle < 3; cycle++) {
        CHECK(golf_players_set_debug_test(players, &player_count, 3, spawn, true));
        CHECK(player_count == 5 && memcmp(&players[0], &saved_local, sizeof(saved_local)) == 0);
        for (int i = 1; i < player_count; i++) {
            CHECK(players[i].connected && !players[i].ball.is_moving);
            CHECK(vec3_equal(players[i].ball.pos, spawn));
            CHECK(vec3_equal(players[i].ball.draw_pos, spawn));
            for (int j = 0; j < i; j++) CHECK(players[i].id != players[j].id);
        }
        CHECK(strcmp(players[1].name, "Ana") == 0);
        CHECK(players[1].color.x == 1 && players[2].color.z == 1);
        CHECK(!golf_players_set_debug_test(players, &player_count, 3, spawn, true));
        players[1].ball.is_in_water = true;
        players[1].ball.is_in_hole = true;
        golf_player_start_level(&players[1], spawn);
        CHECK(!players[1].ball.is_in_water && !players[1].ball.is_in_hole);
        CHECK(golf_players_set_debug_test(players, &player_count, 3, spawn, false));
        CHECK(player_count == 1 && memcmp(&players[0], &saved_local, sizeof(saved_local)) == 0);
        CHECK(players[1].id == 0 && !players[1].connected);
    }
    CHECK(!golf_players_set_debug_test(players, &player_count, 999, spawn, true));
    CHECK(player_count == 1);
    puts("Player lifecycle: reset, identity, fixture toggles and isolation across 50 slots passed.");
    return 0;
}
