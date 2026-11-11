#ifndef GOLF_CAT_POSE_H
#define GOLF_CAT_POSE_H
#include "common/maths.h"
#include <math.h>
#define GOLF_CAT_PATROL_RATE .95f
/* One clock for the original cat's actual crossing and rendered step. */
static inline float golf_cat_patrol_angle(float time,float offset){return time*GOLF_CAT_PATROL_RATE+offset;}
typedef struct golf_cat_pose {vec3 forward;float stride,gait;} golf_cat_pose_t;
static inline golf_cat_pose_t golf_cat_patrol_pose(float time,float offset,float span,vec3 across){
    if(span<.001f)return (golf_cat_pose_t){.forward=across,.stride=0,.gait=0};
    float angle=golf_cat_patrol_angle(fmaxf(time,0),offset),part=fmodf(angle,MF_PI);
    float distance=span*(floorf(angle/MF_PI)*2+(part<=MF_PI*.5f?sinf(part):2-sinf(part)));
    return (golf_cat_pose_t){.forward=vec3_scale(across,cosf(angle)<0?-1:1),
        .stride=distance*(2*MF_PI/.42f),.gait=golf_clampf(fabsf(cosf(angle))*span*GOLF_CAT_PATROL_RATE/.18f,0,1)};
}
#endif
