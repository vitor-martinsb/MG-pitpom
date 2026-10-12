//@begin_vert
#version 450
layout(binding = 0) uniform ball_vs_params {
    mat4 proj_view_mat;
    mat4 model_mat;
};

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 texture_coord;

layout(location = 0) out vec3 frag_normal;
layout(location = 1) out vec2 frag_texture_coord;

void main() {
    gl_Position = proj_view_mat * model_mat * vec4(position, 1.0);
    frag_normal = normalize((transpose(inverse(model_mat)) * vec4(normal, 0.0)).xyz);
    frag_texture_coord = texture_coord;
}
//@end

//@begin_frag
#version 450
layout(binding = 0) uniform ball_fs_params {
    vec4 color;
};
layout(binding = 0) uniform sampler2D ball_normal_map;

layout(location = 0) in vec3 frag_normal;
layout(location = 1) in vec2 frag_texture_coord;

layout(location = 0) out vec4 g_frag_color;

void main() {
    vec3 n = texture(ball_normal_map, vec2(frag_texture_coord.x, 1.0 - frag_texture_coord.y)).xyz;
    n = 2.0 * n - 1.0;
    float dimples = 0.90 + 0.10 * abs(dot(normalize(n), normalize(vec3(-2.0, -3.0, -10.0))));
    float sunlight = max(dot(normalize(frag_normal), normalize(vec3(-0.5, 0.9, 0.35))), 0.0);
    float rim = pow(1.0 - abs(frag_normal.z), 3.0) * 0.055;
    vec3 ceramic = color.rgb * dimples * (0.60 + 0.40 * sunlight) + vec3(1.0, 0.91, 0.73) * rim;
    g_frag_color = vec4(ceramic, color.a);
}
//@end
