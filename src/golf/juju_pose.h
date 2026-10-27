#ifndef GOLF_JUJU_POSE_H
#define GOLF_JUJU_POSE_H
#include "common/maths.h"

/* One connected skeleton for resting, walking and the paw swipe. Roots stay
   inside the same torso ellipsoid; only knees, feet and paw size blend. */
typedef struct golf_juju_leg_pose {
    vec3 root,knee,foot,paw_size;
} golf_juju_leg_pose_t;
static inline golf_juju_leg_pose_t golf_juju_leg_pose(int leg,float torso_y,float phase,float gait,float slap){
    gait=golf_clampf(gait,0,1);
    bool front=leg<2;float side=leg%2?1.f:-1.f;
    float cycle=fmodf(phase/(2*MF_PI)+((leg==0||leg==3)?0:.5f),1);
    float stride=(cycle<.5f?.105f-.42f*cycle:-.105f+.42f*(cycle-.5f))*gait;
    float lift=cycle<.5f?0:sinf((cycle-.5f)*2*MF_PI)*.075f*gait;
    golf_juju_leg_pose_t p;
    p.root=V3(side*.14f,torso_y-.02f,front?.12f:-.34f);
    p.foot=V3(side*(front?.16f:.18f),.09f-.025f*gait+lift,
        (front?.40f-.12f*gait:-.36f)+stride);
    vec3 folded=V3(side*(front?.16f:.22f),.12f,front?.25f:-.34f);
    vec3 standing=V3(side*(front?.15f:.17f),(p.root.y+p.foot.y)*.48f,
        (front?.28f:-.36f)+stride*.35f);
    p.knee=vec3_add(vec3_scale(folded,1-gait),vec3_scale(standing,gait));
    p.paw_size=V3((front?.09f:.12f)*(1-gait)+.068f*gait,
        .08f*(1-gait)+.052f*gait,(front?.20f:.15f)*(1-gait)+.105f*gait);
    if(leg==1){
        p.foot=vec3_add(p.foot,V3(.22f*slap,.16f*slap,-.09f*slap));
        p.knee=vec3_add(p.knee,V3(.09f*slap,.07f*slap,-.03f*slap));
    }
    return p;
}
#endif
