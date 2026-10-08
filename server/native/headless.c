/* Headless adapters: geometry stays in common/level.c; no GPU or audio is created. */
#include "common/alloc.h"
#include "common/data.h"
#include "common/level.h"
#include "common/json.h"
#include "common/log.h"
#include "fast_obj/fast_obj.h"
#include "parson/parson.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

static JSON_Value *config_json;
static golf_model_t models[128];
static char paths[128][GOLF_FILE_MAX_PATH];
static int model_count;
typedef union allocation_header { size_t size; max_align_t alignment; } allocation_header_t;
static size_t allocated_bytes;

void *golf_alloc_tracked(size_t n, const char *category) { (void)category;allocation_header_t *h=calloc(1,sizeof(*h)+n);if(!h)return NULL;h->size=n;allocated_bytes+=n;return h+1; }
void *golf_realloc_tracked(void *p, size_t n, const char *category) { (void)category;if(!p)return golf_alloc_tracked(n,category);allocation_header_t *h=(allocation_header_t*)p-1;size_t old=h->size;h=realloc(h,sizeof(*h)+n);if(!h)return NULL;h->size=n;allocated_bytes=allocated_bytes-old+n;return h+1; }
void golf_free_tracked(void *p) { if(!p)return;allocation_header_t *h=(allocation_header_t*)p-1;allocated_bytes-=h->size;free(h); }
size_t headless_allocated_bytes(void) { return allocated_bytes; }
void golf_log_warning(const char *format, ...) { va_list args; va_start(args, format); vfprintf(stderr, format, args); fputc('\n', stderr); va_end(args); }
void golf_log_error(const char *format, ...) { va_list args; va_start(args, format); vfprintf(stderr, format, args); fputc('\n', stderr); va_end(args); }
float golf_config_get_num(golf_config_t *c, const char *key) { (void)c; return (float)json_object_get_number(json_value_get_object(config_json), key); }
vec3 golf_config_get_vec3(golf_config_t *c, const char *key) { (void)c; return golf_json_object_get_vec3(json_value_get_object(config_json), key); }
void headless_config_load(void) { config_json = json_parse_file("data/config/game.cfg"); if (!config_json) exit(2); }
golf_texture_t *golf_data_get_texture(const char *path) { (void)path; return NULL; }

golf_model_group_t golf_model_group(const char *name, int start, int count) {
    golf_model_group_t g = {0}; snprintf(g.material_name, sizeof(g.material_name), "%s", name); g.start_vertex = start; g.vertex_count = count; return g;
}
golf_model_t golf_model_dynamic(vec_golf_group_t groups, vec_vec3_t positions, vec_vec3_t normals, vec_vec2_t texcoords) {
    golf_model_t m = {0}; m.groups = groups; m.positions = positions; m.normals = normals; m.texcoords = texcoords; return m;
}
golf_model_t golf_model_dynamic_water(vec_golf_group_t groups, vec_vec3_t positions, vec_vec3_t normals, vec_vec2_t texcoords, vec_vec3_t water_dir) {
    golf_model_t m = golf_model_dynamic(groups, positions, normals, texcoords); m.is_water = true; m.water_dir = water_dir; return m;
}
void golf_model_dynamic_finalize(golf_model_t *m) { (void)m; }
void golf_model_dynamic_update_sg_buf(golf_model_t *m) { (void)m; }

golf_model_t *golf_data_get_model(const char *path) {
    for (int i = 0; i < model_count; i++) if (!strcmp(paths[i], path)) return &models[i];
    if (model_count >= 128) exit(2);
    fastObjMesh *obj = fast_obj_read(path);
    if (!obj) { fprintf(stderr, "Cannot load model %s\n", path); exit(2); }
    int slot = model_count++;
    snprintf(paths[slot], sizeof(paths[slot]), "%s", path);
    golf_model_t *m = &models[slot];
    vec_init(&m->positions, "headless-model"); vec_init(&m->normals, "headless-model"); vec_init(&m->texcoords, "headless-model"); vec_init(&m->groups, "headless-model");
    unsigned offset = 0;
    for (unsigned f = 0; f < obj->face_count; f++) {
        unsigned material = obj->face_materials[f];
        const char *name = material < obj->material_count ? obj->materials[material].name : "default";
        if (!name) name = "default";
        if (!m->groups.length || strcmp(m->groups.data[m->groups.length-1].material_name, name)) vec_push(&m->groups, golf_model_group(name, m->positions.length, 0));
        for (unsigned v = 1; v + 1 < obj->face_vertices[f]; v++) {
            unsigned triangle[3] = {offset, offset+v, offset+v+1};
            for (int j = 0; j < 3; j++) {
                fastObjIndex idx = obj->indices[triangle[j]];
                vec_push(&m->positions, V3(obj->positions[idx.p*3], obj->positions[idx.p*3+1], obj->positions[idx.p*3+2]));
                vec_push(&m->normals, V3(obj->normals[idx.n*3], obj->normals[idx.n*3+1], obj->normals[idx.n*3+2]));
                vec_push(&m->texcoords, V2(obj->texcoords[idx.t*2], obj->texcoords[idx.t*2+1]));
                m->groups.data[m->groups.length-1].vertex_count++;
            }
        }
        offset += obj->face_vertices[f];
    }
    fast_obj_destroy(obj);
    return m;
}

static golf_transform_t transform(JSON_Object *entity) {
    JSON_Object *t = json_object_get_object(entity, "transform");
    vec4 q = golf_json_object_get_vec4(t, "rotation");
    return golf_transform(golf_json_object_get_vec3(t, "position"), golf_json_object_get_vec3(t, "scale"), QUAT(q.x,q.y,q.z,q.w));
}
static golf_movement_t movement(JSON_Object *entity) {
    JSON_Object *m = json_object_get_object(entity, "movement");
    const char *type = json_object_get_string(m, "type");
    float t0 = (float)json_object_get_number(m, "t0"), length = (float)json_object_get_number(m, "length");
    if (!type) return golf_movement_none();
    if (!strcmp(type,"linear")) return golf_movement_linear(t0, golf_json_object_get_vec3(m,"p0"), golf_json_object_get_vec3(m,"p1"), length);
    if (!strcmp(type,"spinner")) return golf_movement_spinner(t0,length);
    if (!strcmp(type,"pendulum")) return golf_movement_pendulum(t0,length,(float)json_object_get_number(m,"theta0"),golf_json_object_get_vec3(m,"axis"));
    if (!strcmp(type,"ramp")) return golf_movement_ramp(t0,length,(float)json_object_get_number(m,"theta0"),(float)json_object_get_number(m,"theta1"),(float)json_object_get_number(m,"transition_length"),golf_json_object_get_vec3(m,"axis"));
    return golf_movement_none();
}
static golf_geo_t geometry(JSON_Object *entity, bool water) {
    JSON_Object *obj = json_object_get_object(entity,"geo");
    vec_golf_geo_point_t points; vec_init(&points,"headless-geo");
    vec_golf_geo_face_t faces; vec_init(&faces,"headless-geo");
    vec_golf_geo_generator_data_arg_t args; vec_init(&args,"headless-geo");
    JSON_Array *p = json_object_get_array(obj,"p");
    for (size_t i=0; i<json_array_get_count(p); i+=3) vec_push(&points,golf_geo_point(V3(json_array_get_number(p,i),json_array_get_number(p,i+1),json_array_get_number(p,i+2))));
    JSON_Array *f = json_object_get_array(obj,"faces");
    for (size_t i=0; i<json_array_get_count(f); i++) {
        JSON_Object *face = json_array_get_object(f,i);
        vec_int_t idx; vec_init(&idx,"headless-geo");
        vec_vec2_t uvs; vec_init(&uvs,"headless-geo");
        JSON_Array *indices=json_object_get_array(face,"idxs"), *uv=json_object_get_array(face,"uvs");
        for (size_t j=0; j<json_array_get_count(indices); j++) vec_push(&idx,(int)json_array_get_number(indices,j));
        for (size_t j=0; j<json_array_get_count(uv); j+=2) vec_push(&uvs,V2(json_array_get_number(uv,j),json_array_get_number(uv,j+1)));
        int uv_type=0; const char *name=json_object_get_string(face,"uv_gen_type");
        for (int j=0; j<GOLF_GEO_FACE_UV_GEN_COUNT; j++) if (name && !strcmp(name,golf_geo_uv_gen_type_strings()[j])) uv_type=j;
        vec_push(&faces,golf_geo_face(json_object_get_string(face,"material_name"),idx,(golf_geo_face_uv_gen_type_t)uv_type,uvs,golf_json_object_get_vec3(face,"water_dir")));
    }
    return golf_geo(points,faces,golf_geo_generator_data(NULL,args),water);
}

bool headless_level_load(golf_level_t *level, const char *path) {
    JSON_Value *value=json_parse_file(path); if (!value) return false;
    JSON_Object *root=json_value_get_object(value);
    vec_init(&level->materials,"headless-level"); vec_init(&level->entities,"headless-level");
    JSON_Array *materials=json_object_get_array(root,"materials");
    for (size_t i=0;i<json_array_get_count(materials);i++) {
        JSON_Object *o=json_array_get_object(materials,i);
        golf_material_t m={0}; m.active=true;
        snprintf(m.name,sizeof(m.name),"%s",json_object_get_string(o,"name"));
        m.friction=(float)json_object_get_number(o,"friction"); m.restitution=(float)json_object_get_number(o,"restitution"); m.vel_scale=(float)json_object_get_number(o,"vel_scale");
        vec_push(&level->materials,m);
    }
    golf_lightmap_section_t lightmap={0};
    JSON_Array *entities=json_object_get_array(root,"entities");
    for (size_t i=0;i<json_array_get_count(entities);i++) {
        JSON_Object *o=json_array_get_object(entities,i); const char *type=json_object_get_string(o,"type"), *name=json_object_get_string(o,"name");
        golf_transform_t t=transform(o); golf_entity_t e={0};
        if (!type) { json_value_free(value); return false; }
        if (!name) name="";
        if (!strcmp(type,"model")) e=golf_entity_model(name,t,json_object_get_string(o,"model"),(float)json_object_get_number(o,"uv_scale"),lightmap,movement(o),json_object_get_boolean(o,"ignore_physics")==1);
        else if (!strcmp(type,"ball-start")) e=golf_entity_ball_start(name,t);
        else if (!strcmp(type,"hole")) e=golf_entity_hole(name,t);
        else if (!strcmp(type,"geo")) e=golf_entity_geo(name,t,movement(o),geometry(o,false),lightmap);
        else if (!strcmp(type,"water")) e=golf_entity_water(name,t,geometry(o,true),lightmap);
        else if (!strcmp(type,"group")) e=golf_entity_group(name,t);
        else if (!strcmp(type,"begin_animation")) e=golf_entity_begin_animation(name,t);
        else if (!strcmp(type,"camera_zone")) e=golf_entity_camera_zone(name,json_object_get_boolean(o,"towards_hole")==1,t);
        else { fprintf(stderr,"Unknown entity %s\n",type); json_value_free(value); return false; }
        e.parent_idx=(int)json_object_get_number(o,"parent_idx"); vec_push(&level->entities,e);
    }
    json_value_free(value); return true;
}
