#ifndef GOLF_ONLINE_H
#define GOLF_ONLINE_H
#include "golf/player.h"
bool golf_online_active(void);
bool golf_online_can_shoot(void);
bool golf_online_input_blocked(void);
void golf_online_update(float dt);
bool golf_online_shoot(vec3 direction, float power);
golf_player_t *golf_online_camera_player(void);
#endif
