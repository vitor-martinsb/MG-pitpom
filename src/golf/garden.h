#ifndef GOLF_GARDEN_H
#define GOLF_GARDEN_H
#include "common/level.h"

/* Render-only scenery. No entities, collision meshes or simulation state change. */
void golf_garden_prepare(golf_level_t *level, int level_number);
bool golf_garden_replaces_tree(const golf_entity_t *entity);
bool golf_garden_replaces_flag(const golf_entity_t *entity);
void golf_garden_draw_world(float time);
vec4 golf_garden_sky_color(void);
void golf_garden_draw_feedback(float time);
golf_texture_t *golf_garden_material(const golf_material_t *material, float *kind);
unsigned golf_garden_vertex_count(void);
unsigned golf_garden_actor_vertex_count(void);
float golf_garden_landscape_gap(void);
vec3 golf_garden_flag_point(float u,float side,float time);
float golf_garden_flag_time(void);
#endif
