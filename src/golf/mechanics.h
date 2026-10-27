#ifndef GOLF_MECHANICS_H
#define GOLF_MECHANICS_H
#include "common/bvh.h"
#include "golf/player.h"
#include "golf/navigation.h"
#include "golf/wildlife.h"

typedef struct golf_resident_layout {
    vec3 cat,dog,direction,across;float span;
    golf_wild_animal_t animals[GOLF_WILDLIFE_COUNT];
} golf_resident_layout_t;
/* Shared, allocation-free state: native authority and the offline game. */
typedef struct golf_mechanics {
    bool enabled, impact, cat_valid, dog_valid;
    bool cat_present, dog_present;
    int third_kind;
    float cat_presence,dog_presence,cat_phase;
    uint32_t seed;
    float forward_probability, slap_speed, reach, cooldown;
    vec3 start, hole, direction, across, cat_center, cat, dog;
    vec3 bounds_min, bounds_max;
    float cat_span, cat_slap_time, dog_wake_time;
    golf_wildlife_t wildlife;
    golf_resident_layout_t resident_base;
} golf_mechanics_t;
void golf_mechanics_init(golf_mechanics_t *, golf_level_t *, golf_bvh_t *);
void golf_mechanics_seed(golf_mechanics_t *,uint32_t,int previous_pet);
void golf_mechanics_animate(golf_mechanics_t *, float time);
void golf_mechanics_tick(golf_mechanics_t *, golf_player_t *, int count, float time);
void golf_mechanics_impacts(golf_player_t *, int count);
void golf_ball_return_before_shot(golf_player_t *);
const golf_navigation_t *golf_mechanics_navigation(void);
#endif
