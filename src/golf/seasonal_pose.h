#ifndef GOLF_SEASONAL_POSE_H
#define GOLF_SEASONAL_POSE_H
#include "common/maths.h"
/* The garment is a close offset of the exact, currently animated torso.
   There is no separate fixed-height body, collar or floating button layer. */
static inline vec3 golf_season_coat_point(vec3 center,vec3 size,vec3 normal){
    return vec3_add(center,V3(normal.x*(size.x+.009f),normal.y*(size.y+.009f),normal.z*(size.z+.009f)));
}
static inline bool golf_season_coat_open(vec3 n){
    return (n.y<-.20f&&fabsf(n.z)>.45f&&fabsf(n.x)>.24f)||
        (n.z<-.82f&&fabsf(n.x)<.30f&&n.y>-.20f&&n.y<.60f);
}
#endif
