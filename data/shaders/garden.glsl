//@begin_vert
#version 450
layout(binding = 0) uniform garden_vs_params {
    mat4 proj_view_mat;
    vec4 motion;
};
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 0) out vec3 frag_position;
layout(location = 1) out vec3 frag_normal;
layout(location = 2) out vec3 frag_color;
layout(location = 3) out float frag_kind;
void main() {
    vec3 p = position;
    if (color.a > 1.5) {
        p.x += sin(motion.x * 0.035 + position.z * 0.06) * 2.5;
    } else {
        p.x += sin(motion.x * 0.9 + p.x * 0.73 + p.z * 0.61) * 0.045 * color.a;
        p.z += cos(motion.x * 0.7 + p.x * 0.45) * 0.025 * color.a;
    }
    frag_position = p;
    frag_normal = normal;
    frag_color = color.rgb;
    frag_kind = color.a;
    gl_Position = proj_view_mat * vec4(p, 1.0);
}
//@end
//@begin_frag
#version 450
layout(binding = 0) uniform garden_fs_params {
    vec4 camera_position;
    vec4 style;
};
layout(binding = 0) uniform sampler2D brush_texture;
layout(location = 0) in vec3 frag_position;
layout(location = 1) in vec3 frag_normal;
layout(location = 2) in vec3 frag_color;
layout(location = 3) in float frag_kind;
layout(location = 0) out vec4 g_frag_color;
void main() {
    float sunlight = 0.80 + 0.22 * dot(normalize(frag_normal), normalize(vec3(-0.5, 0.9, 0.35)));
    vec3 paint = frag_color * mix(1.0, sunlight, style.z);
    if (frag_kind > 0.75 && frag_kind < 1.25) {
        vec3 brush = texture(brush_texture, frag_position.xz * 0.18 + frag_position.y * 0.05).rgb;
        float pigment = dot(brush, vec3(0.3,0.5,0.2));
        paint *= 0.88 + pigment * 0.30;
    }
    paint *= mix(vec3(1.0), vec3(1.045, 1.015, 0.94), style.z);
    float distance_fog = smoothstep(35.0, 125.0, distance(frag_position, camera_position.xyz)) * style.y;
    g_frag_color = vec4(mix(paint, vec3(0.72, 0.83, 0.80), distance_fog * 0.72), style.x);
}
//@end
