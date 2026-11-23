#ifndef GOLF_ALFREDO_H
#define GOLF_ALFREDO_H
#include "golf/companions.h"
#define GOLF_CAPTURE_ALFREDO 9
#define GOLF_EFFECT_ALFREDO 18
enum {ALFREDO_IDLE,ALFREDO_APPROACH,ALFREDO_CAPTURE,ALFREDO_ROLL,ALFREDO_JUGGLE,ALFREDO_KICK,ALFREDO_RECOVER,ALFREDO_RETURN,ALFREDO_COOLDOWN};
struct golf_wildlife;
void golf_alfredo_init(struct golf_wildlife *,vec3,vec3);
void golf_alfredo_tick(struct golf_wildlife *,golf_player_t *,int,float,uint32_t,bool);
#endif
