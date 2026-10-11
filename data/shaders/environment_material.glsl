//@begin_vert
#version 450

layout(binding = 0) uniform environment_material_vs_params {
    mat4 model_mat;
    mat4 proj_view_mat;
};

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texturecoord;
layout(location = 2) in vec3 normal;
layout(location = 3) in vec2 lightmap_uv;

layout(location = 0) out vec3 frag_position;
layout(location = 1) out vec2 frag_texturecoord;
layout(location = 2) out vec3 frag_normal;
layout(location = 3) out vec2 frag_lightmap_uv;

void main() {
    frag_position = (model_mat * vec4(position, 1.0)).xyz;
    frag_texturecoord = texturecoord;
    frag_normal = normalize((transpose(inverse(model_mat)) * vec4(normal, 0.0)).xyz);
    frag_lightmap_uv = lightmap_uv;
    gl_Position = proj_view_mat * model_mat * vec4(position, 1.0);
}
//@end

//@begin_frag
#version 450

layout(binding = 0) uniform environment_material_fs_params {
    vec4 ball_position;
    float lightmap_texture_a;
    float uv_scale;
    vec4 camera_position;
    vec4 garden_surface;
};

layout(binding = 0) uniform sampler2D environment_material_texture;
layout(binding = 1) uniform sampler2D environment_material_lightmap_texture0;
layout(binding = 2) uniform sampler2D environment_material_lightmap_texture1;

layout(location = 0) in vec3 frag_position;
layout(location = 1) in vec2 frag_texturecoord;
layout(location = 2) in vec3 frag_normal;
layout(location = 3) in vec2 frag_lightmap_uv;

layout(location = 0) out vec4 g_frag_color;

void main() {
    float gi0 = (1.0 - lightmap_texture_a) * texture(environment_material_lightmap_texture0, frag_lightmap_uv).x;
    float gi1 = lightmap_texture_a * texture(environment_material_lightmap_texture1, frag_lightmap_uv).x; 
    float gi = (gi0 + gi1);
    float dist_to_ball = distance(frag_position.xz, ball_position.xz);
    if (dist_to_ball < 0.14 && frag_position.y < ball_position.y) {
        float scale = (0.14 - dist_to_ball) / 0.14;   
        gi -= scale * scale * 0.8;
    }
    gi = clamp(gi, 0.0, 1.2);
    vec3 color = texture(environment_material_texture, uv_scale * frag_texturecoord).rgb;
    // Broad meadow patches break repetition without moving any surface vertices.
    if (garden_surface.x > 0.5 && garden_surface.x < 1.5) {
        float meadow_variation = sin(frag_position.x * 0.63 + sin(frag_position.z * 0.42)) * cos(frag_position.z * 0.39);
        color *= 0.97 + meadow_variation * 0.06;
    }
    float sunlight = max(dot(normalize(frag_normal), normalize(vec3(-0.5, 0.9, 0.35))), 0.0);
    vec3 painted = color * (0.42 + gi * 0.58) * (0.92 + sunlight * 0.10) * vec3(1.045, 1.02, 0.92);
    float fog = smoothstep(28.0, 100.0, distance(frag_position, camera_position.xyz));
    g_frag_color = vec4(mix(painted, vec3(0.72, 0.83, 0.80), fog * 0.72), 1.0);
}
//@end
