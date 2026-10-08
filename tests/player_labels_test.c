#include <stdio.h>

#include "common/projection.h"
#include "golf/player_labels.h"

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "Failed: %s (line %d)\n", #condition, __LINE__); \
        return 1; \
    } \
} while (0)

static bool near(float a, float b) { return fabsf(a - b) < 0.01f; }

int main(void) {
    mat4 projection = mat4_perspective_projection(66, 800.0f / 600, 0.1f, 150);
    mat4 view = mat4_look_at(V3(0, 0, 0), V3(0, 0, -1), V3(0, 1, 0));
    mat4 camera = mat4_multiply(projection, view);
    vec2 screen = V2(-1, -1);
    CHECK(golf_project_visible(camera, V2(20, 30), V2(800, 600), V3(0, 0, -2), &screen));
    CHECK(near(screen.x, 420) && near(screen.y, 330));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(0, 0, 2), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(0, 0, 0), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(0, 0, -0.01f), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(0, 0, -200), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(100, 0, -2), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(NAN, 0, -2), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(0, 600), V3(0, 0, -2), &screen));
    CHECK(!golf_project_visible(camera, V2(0, 0), V2(800, 600), V3(0, 0, -2), NULL));
    CHECK(golf_project_visible(camera, V2(0, 0), V2(1600, 1200), V3(0, 0, -2), &screen));
    CHECK(near(screen.x, 800) && near(screen.y, 600));
    mat4 identity = mat4_identity();
    CHECK(golf_project_visible(identity, V2(0, 0), V2(800, 600), V3(1, -1, 0), &screen));
    CHECK(near(screen.x, 800) && near(screen.y, 600));

    /* Input order and camera distance must never displace the local label. */
    golf_player_label_t labels[GOLF_MAX_PLAYERS];
    for (int i = 0; i < GOLF_MAX_PLAYERS; i++) {
        labels[i] = (golf_player_label_t){
            .player_id = (uint32_t)(50 - i), .distance_squared = 1,
            .local = i == 49, .pos = V2(400, 300), .size = V2(80, 20),
        };
    }
    labels[49].distance_squared = 100;
    golf_player_labels_layout(labels, GOLF_MAX_PLAYERS, V2(800, 600), 4, 120);
    CHECK(labels[0].player_id == 1 && labels[0].visible && labels[0].local);
    CHECK(near(labels[0].pos.x, 400) && near(labels[0].pos.y, 300));
    CHECK(labels[1].player_id == 2 && labels[1].visible);
    CHECK(labels[49].player_id == 50 && !labels[49].visible);
    int visible = 0;
    for (int i = 0; i < GOLF_MAX_PLAYERS; i++) {
        if (!labels[i].visible) continue;
        visible++;
        CHECK(labels[i].pos.y >= 180);
        for (int j = 0; j < i; j++) {
            if (labels[j].visible) CHECK(fabsf(labels[i].pos.y - labels[j].pos.y) >= 24);
        }
    }
    CHECK(visible == 6);
    golf_player_label_t edge[] = {
        { .player_id = 7, .local = true, .pos = { 0, 0 }, .size = { 80, 20 } },
        { .player_id = 8, .pos = { 0, 0 }, .size = { 80, 20 } },
    };
    golf_player_labels_layout(edge, 2, V2(100, 60), 4, 120);
    CHECK(edge[0].visible && near(edge[0].pos.x, 40) && near(edge[0].pos.y, 10));
    CHECK(!edge[1].visible);
    golf_player_label_t distance[] = {
        { .player_id = 2, .distance_squared = 4, .pos = { 200, 200 }, .size = { 50, 20 } },
        { .player_id = 3, .distance_squared = 1, .pos = { 200, 200 }, .size = { 50, 20 } },
    };
    golf_player_labels_layout(distance, 2, V2(800, 600), 4, 120);
    CHECK(distance[0].player_id == 3 && distance[0].visible);
    puts("Visible projection and bounded label placement across 50 players passed.");
    return 0;
}
