#ifndef GOLF_GARDEN_H
#define GOLF_GARDEN_H
#include "common/level.h"

/* Render-only scenery. No entities, collision meshes or simulation state change. */
void golf_garden_prepare(golf_level_t *level, int level_number);
bool golf_garden_replaces_tree(const golf_entity_t *entity);
void golf_garden_draw_world(float time);
void golf_garden_draw_feedback(float time);
golf_texture_t *golf_garden_material(const golf_material_t *material, float *kind);
unsigned golf_garden_vertex_count(void);
#endif
