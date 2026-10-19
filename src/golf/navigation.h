#ifndef GOLF_NAVIGATION_H
#define GOLF_NAVIGATION_H
#include "common/bvh.h"
#define GOLF_NAV_NODES 4096
#define GOLF_NAV_CELLS 16384
typedef struct golf_nav_node { vec3 pos; float cost; int cell; unsigned char edges; bool reachable; } golf_nav_node_t;
typedef struct golf_navigation {
    golf_nav_node_t nodes[GOLF_NAV_NODES]; short cells[GOLF_NAV_CELLS];
    int count,width,height; float step; vec3 min,max,hole;
    golf_bvh_t *floor;
    bool campaign;
} golf_navigation_t;
bool golf_nav_floor(golf_bvh_t *,vec3,vec3 *,float clearance);
bool golf_nav_segment(golf_bvh_t *,vec3,vec3,float clearance);
void golf_nav_build(golf_navigation_t *,golf_bvh_t *,vec3 start,vec3 hole);
float golf_nav_cost(const golf_navigation_t *,vec3);
vec3 golf_nav_target(const golf_navigation_t *,vec3);
#endif
