#ifndef GOLF_CAT_POSE_H
#define GOLF_CAT_POSE_H
#include "common/maths.h"
#include <math.h>
#define GOLF_CAT_PATROL_SPEED .55f
#define GOLF_CAT_TURN_SECONDS 1.2f
/* Frida's smooth travel and distance-based diagonal steps, with a stationary
 * turn at each end. The same analytic pose drives authority and rendering. */
static inline float golf_cat_travel_seconds(float span){return fmaxf(2,3*span/GOLF_CAT_PATROL_SPEED);}
static inline float golf_cat_patrol_period(float span){return 2*(golf_cat_travel_seconds(span)+GOLF_CAT_TURN_SECONDS);}
typedef struct golf_cat_pose {vec3 forward;float stride,gait,offset,speed;} golf_cat_pose_t;
static inline golf_cat_pose_t golf_cat_patrol_pose(float time,float offset,float span,vec3 across){
    if(span<.001f)return (golf_cat_pose_t){.forward=across};
    float travel=golf_cat_travel_seconds(span),half=travel+GOLF_CAT_TURN_SECONDS;
    float clock=fmaxf(time,0)+offset/(2*MF_PI)*(2*half);
    float crossing=floorf(clock/half),part=clock-crossing*half;
    float u=golf_clampf(part/travel,0,1),ease=u*u*(3-2*u);
    float sign=fmodf(crossing,2)<1?1:-1;
    float speed=part<travel?2*span*6*u*(1-u)/travel:0;
    float turn=golf_clampf((part-travel)/GOLF_CAT_TURN_SECONDS,0,1);turn=turn*turn*(3-2*turn);
    float yaw=atan2f(across.x,across.z)+(sign<0?MF_PI:0)+MF_PI*turn;
    return (golf_cat_pose_t){.forward=V3(sinf(yaw),0,cosf(yaw)),
        .stride=(crossing*2*span+ease*2*span)*(2*MF_PI/.42f),
        .gait=golf_clampf(speed/.18f,0,1),.offset=sign*span*(2*ease-1),.speed=speed};
}
#endif
