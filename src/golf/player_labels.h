#ifndef GOLF_PLAYER_LABELS_H
#define GOLF_PLAYER_LABELS_H

#include "golf/player.h"

typedef struct golf_player_label {
    uint32_t player_id;
    float distance_squared;
    bool local, visible;
    vec2 pos, size;
} golf_player_label_t;

/* Sort local first, then distance/ID; place bounded screen rectangles only. */
void golf_player_labels_layout(golf_player_label_t *labels, int count,
        vec2 viewport_size, float padding, float max_shift);

#endif
