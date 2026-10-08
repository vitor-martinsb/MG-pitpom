#ifndef GOLF_PROJECTION_H
#define GOLF_PROJECTION_H

#include "common/maths.h"

/* OpenGL clip volume; output is in viewport pixels, including its origin. */
bool golf_project_visible(mat4 proj_view, vec2 viewport_pos, vec2 viewport_size,
        vec3 world_pos, vec2 *screen_pos);

#endif
