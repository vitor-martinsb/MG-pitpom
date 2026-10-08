#include "golf/player.h"

void golf_player_start_level(golf_player_t *player, vec3 start_pos) {
    player->stroke_count = 0;
    memset(&player->ball, 0, sizeof(player->ball));
    player->ball.start_pos = start_pos;
    player->ball.pos = start_pos;
    player->ball.draw_pos = start_pos;
    player->ball.orientation = QUAT(0, 0, 0, 1);
    player->ball.radius = GOLF_BALL_RADIUS;
    player->ball.time_out_of_bounds = -1;
    player->ball.time_out_of_water = 1;
}

void golf_player_init(golf_player_t *player, uint32_t id, const char *name,
        vec4 color, int avatar_id) {
    memset(player, 0, sizeof(*player));
    player->id = id;
    snprintf(player->name, sizeof(player->name), "%s", name ? name : "Player");
    player->color = color;
    player->avatar_id = avatar_id;
    player->connected = true;
    golf_player_start_level(player, V3(0, 0, 0));
}

bool golf_players_set_debug_test(golf_player_t players[GOLF_MAX_PLAYERS],
        int *player_count, uint32_t local_id, vec3 spawn, bool enabled) {
    if (!players || !player_count || (*player_count != 1 && *player_count != 5)) return false;
    golf_player_t *local = NULL;
    for (int i = 0; i < *player_count; i++) {
        if (players[i].id == local_id) local = &players[i];
    }
    if (!local) return false;
    if (enabled) {
        if (*player_count != 1) return false;
        static const char *names[] = { "Ana", "Joao", "Pedro", "Lucas" };
        const vec4 colors[] = {
            V4(1, 0.15f, 0.15f, 1), V4(0.15f, 0.35f, 1, 1),
            V4(0.15f, 0.85f, 0.25f, 1), V4(1, 0.85f, 0.1f, 1)
        };
        uint32_t id = 1;
        for (int i = 0; i < 4; i++) {
            if (id == local_id) id++;
            golf_player_t *player = &players[(*player_count)++];
            golf_player_init(player, id++, names[i], colors[i], i);
            golf_player_start_level(player, spawn);
        }
    }
    else if (*player_count == 5) {
        golf_player_t saved = *local;
        memset(players, 0, sizeof(*players) * GOLF_MAX_PLAYERS);
        players[0] = saved;
        *player_count = 1;
    }
    return true;
}
