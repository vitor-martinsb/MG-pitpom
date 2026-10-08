#include "golf/player_labels.h"

static bool _before(golf_player_label_t a, golf_player_label_t b) {
    if (a.local != b.local) return a.local;
    if (a.distance_squared != b.distance_squared) return a.distance_squared < b.distance_squared;
    return a.player_id < b.player_id;
}

static bool _overlap(golf_player_label_t a, golf_player_label_t b, float padding) {
    return fabsf(a.pos.x - b.pos.x) < 0.5f * (a.size.x + b.size.x) + padding &&
        fabsf(a.pos.y - b.pos.y) < 0.5f * (a.size.y + b.size.y) + padding;
}

void golf_player_labels_layout(golf_player_label_t *labels, int count,
        vec2 viewport_size, float padding, float max_shift) {
    if (!labels || count < 0 || count > GOLF_MAX_PLAYERS) return;
    for (int i = 1; i < count; i++) {
        golf_player_label_t label = labels[i];
        int j = i;
        while (j > 0 && _before(label, labels[j - 1])) {
            labels[j] = labels[j - 1];
            j--;
        }
        labels[j] = label;
    }
    for (int i = 0; i < count; i++) {
        golf_player_label_t *label = &labels[i];
        label->visible = false;
        if (label->size.x > viewport_size.x || label->size.y > viewport_size.y) continue;
        label->pos.x = golf_clampf(label->pos.x, 0.5f * label->size.x,
                viewport_size.x - 0.5f * label->size.x);
        label->pos.y = golf_clampf(label->pos.y, 0.5f * label->size.y,
                viewport_size.y - 0.5f * label->size.y);
        float base_y = label->pos.y;
        for (int attempt = 0; attempt < 6; attempt++) {
            float shift = attempt * (label->size.y + padding);
            if (shift > max_shift) break;
            label->pos.y = base_y - shift;
            if (label->pos.y - 0.5f * label->size.y < 0) break;
            bool blocked = false;
            for (int j = 0; j < i; j++) {
                if (labels[j].visible && _overlap(*label, labels[j], padding)) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) {
                label->visible = true;
                break;
            }
        }
    }
}
