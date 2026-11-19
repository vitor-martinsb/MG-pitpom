#ifndef GOLF_MEG_POSE_H
#define GOLF_MEG_POSE_H
#include "golf/wildlife.h"
#define GOLF_MEG_LOWER_TIME .24f
#define GOLF_MEG_RISE_AT .80f
#define GOLF_MEG_STAND_AT 1.35f
static inline float golf_meg_smooth(float t){t=golf_clampf(t,0,1);return t*t*(3-2*t);}
/* Shared by the authority, held-ball position and connected 3D skeleton. */
static inline float golf_meg_lie(const golf_wild_animal_t *a,float time){
    if(a->action!=MEG_RELEASING&&a->action!=MEG_COOLDOWN)return 0;
    float age=fmaxf(0,time-a->action_time);
    if(age<GOLF_MEG_LOWER_TIME)return a->meg_pose_from+(1-a->meg_pose_from)*golf_meg_smooth(age/GOLF_MEG_LOWER_TIME);
    if(age<GOLF_MEG_RISE_AT)return 1;
    return 1-golf_meg_smooth((age-GOLF_MEG_RISE_AT)/(GOLF_MEG_STAND_AT-GOLF_MEG_RISE_AT));
}
#endif
