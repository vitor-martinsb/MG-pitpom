#ifndef GOLF_COMPANIONS_H
#define GOLF_COMPANIONS_H
#include "golf/navigation.h"
#include "golf/player.h"
#define GOLF_CAPTURE_BENEDITA 7
#define GOLF_CAPTURE_SMANATA 8
#define GOLF_EFFECT_BENEDITA 16
#define GOLF_EFFECT_SMANATA 17
enum {SMANATA_IDLE,SMANATA_CHASING,SMANATA_CARRYING,SMANATA_HOLDING,SMANATA_RETURNING,SMANATA_COOLDOWN};
typedef struct golf_companion {
    bool active;int state;uint32_t player,cycles;
    vec3 home,pos,draw_pos,forward,look;
    float until,cooldown,clock,stride,speed;
    float draw_stride,draw_speed; /* Presentation interpolation, never authoritative physics. */
} golf_companion_t;
typedef struct golf_companions {
    golf_companion_t benedita,smanata,alfredo;
    uint32_t alfredo_launches;
    unsigned char dog_nodes[GOLF_NAV_NODES],dog_edges[GOLF_NAV_NODES];
    short path[GOLF_NAV_NODES];int path_count,path_index;
    vec3 goal;float time;
} golf_companions_t;
struct golf_wildlife;
void golf_companions_init(struct golf_wildlife *,vec3,vec3);
void golf_companions_tick(struct golf_wildlife *,golf_player_t *,int,float,uint32_t,bool);
vec3 golf_smanata_mouth(const golf_companion_t *,bool);
bool golf_smanata_release(struct golf_wildlife *,golf_player_t *,float);
#endif
