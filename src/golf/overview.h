#ifndef GOLF_OVERVIEW_H
#define GOLF_OVERVIEW_H
#include "common/maths.h"
/* A fixed, elevated three-quarter view. Fit the course and its tallest
 * geometry to the actual viewport without tracking players or their balls. */
static inline vec3 golf_overview_position(vec3 min,vec3 max,float skyline,float aspect){
    vec3 center=vec3_scale(vec3_add(min,max),.5f);
    vec3 back=vec3_normalize(V3(.65f,.9f,1));
    vec3 right=vec3_normalize(vec3_cross(vec3_scale(back,-1),V3(0,1,0)));
    vec3 up=vec3_cross(right,vec3_scale(back,-1));
    float vertical=tanf(33*MF_PI/180),horizontal=vertical*fmaxf(.1f,aspect);
    float distance=fmaxf(6,(skyline-center.y+1)/back.y);
    max.y=fmaxf(max.y,skyline);
    for(int corner=0;corner<8;corner++){
        vec3 q=vec3_sub(V3(corner&1?max.x:min.x,corner&2?max.y:min.y,corner&4?max.z:min.z),center);
        float depth=vec3_dot(q,back);
        distance=fmaxf(distance,depth+(fabsf(vec3_dot(q,right))+.35f)*1.12f/horizontal);
        distance=fmaxf(distance,depth+(fabsf(vec3_dot(q,up))+.35f)*1.12f/vertical);
    }
    return vec3_add(center,vec3_scale(back,distance));
}
/* A closer follow shot for every waiting participant, with a personal zoom. */
static inline vec3 golf_spectator_position(vec3 min,vec3 max,float skyline,float aspect,vec3 focus,float zoom){
    vec3 center=vec3_scale(vec3_add(min,max),.5f);
    float distance=golf_clampf(vec3_distance(golf_overview_position(min,max,skyline,aspect),center)*.55f,7,12)*golf_clampf(zoom,.65f,2.25f);
    return vec3_add(focus,vec3_scale(vec3_normalize(V3(.65f,.9f,1)),distance));
}
static inline float golf_overview_far_plane(vec3 min,vec3 max,float skyline,vec3 position){
    vec3 center=vec3_scale(vec3_add(min,max),.5f);
    max.y=fmaxf(max.y,skyline);
    return fmaxf(150,vec3_distance(position,center)+vec3_distance(min,max)+2);
}
#endif
