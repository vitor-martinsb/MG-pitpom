#include "common/projection.h"

bool golf_project_visible(mat4 proj_view, vec2 viewport_pos, vec2 viewport_size,
        vec3 world_pos, vec2 *screen_pos) {
    if (!screen_pos || !isfinite(viewport_size.x) || !isfinite(viewport_size.y) ||
            viewport_size.x <= 0 || viewport_size.y <= 0 ||
            !isfinite(viewport_pos.x) || !isfinite(viewport_pos.y)) return false;
    vec4 clip = vec4_apply_mat(V4(world_pos.x, world_pos.y, world_pos.z, 1), proj_view);
    if (!isfinite(clip.x) || !isfinite(clip.y) || !isfinite(clip.z) ||
            !isfinite(clip.w) || clip.w <= 0 ||
            fabsf(clip.x) > clip.w || fabsf(clip.y) > clip.w ||
            fabsf(clip.z) > clip.w) return false;
    vec2 screen = V2(viewport_pos.x + (0.5f + 0.5f * clip.x / clip.w) * viewport_size.x,
            viewport_pos.y + (0.5f - 0.5f * clip.y / clip.w) * viewport_size.y);
    if (!isfinite(screen.x) || !isfinite(screen.y)) return false;
    *screen_pos = screen;
    return true;
}
