#ifndef GOLF_OVERVIEW_H
#define GOLF_OVERVIEW_H
#include "common/maths.h"
/* Fixed field framing, independent of balls, turns and animation time. */
static inline vec3 golf_overview_position(vec3 min,vec3 max,float skyline,float aspect){
    float height=fmaxf(8,fmaxf((max.x-min.x)/fmaxf(.1f,aspect),max.z-min.z)*1.2f);
    return V3((min.x+max.x)*.5f,skyline+height,(min.z+max.z)*.5f+height*.12f);
}
#endif
