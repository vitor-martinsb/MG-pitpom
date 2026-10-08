#include "golf/online.h"
#include "golf/physics.h"
#include "golf/game.h"

#include <assert.h>
#include <float.h>

#define CIMGUI_DEFINE_ENUMS_AND_STRUCTS
#include "cimgui/cimgui.h"

#include "common/audio.h"
#include "common/common.h"
#include "common/data.h"
#include "common/debug_console.h"
#include "common/graphics.h"
#include "common/inputs.h"
#include "common/log.h"
#include "common/storage.h"
#include "golf/golf.h"

static golf_game_t game;
static golf_t *golf;
static golf_graphics_t *graphics;
static golf_inputs_t *inputs;
static golf_config_t *game_cfg;

golf_game_t *golf_game_get(void) {
    return &game;
}

golf_player_t *golf_game_get_player(uint32_t id) {
    for (int i = 0; i < game.player_count; i++) {
        if (game.players[i].id == id) {
            return &game.players[i];
        }
    }
    return NULL;
}

golf_player_t *golf_game_get_local_player(void) {
    golf_player_t *player = golf_game_get_player(game.local_player_id);
    /* Single-player always owns one valid slot, including in the main menu. */
    assert(player);
    return player;
}

bool golf_game_set_debug_test_players(bool enabled) {
    if (golf_online_active()) return false;
    if (enabled == game.debug_test_players) return true;
    if (enabled) {
        if (golf->state != GOLF_STATE_IN_GAME || !golf->level || game.player_count != 1) {
            return false;
        }
    }
    if (!golf_players_set_debug_test(game.players, &game.player_count,
                game.local_player_id, game.ball_start_pos, enabled)) return false;
    game.debug_test_players = enabled;
    return true;
}

static void _golf_game_debug_tab(void) {
    if (golf->state == GOLF_STATE_IN_GAME && golf->level) {
        bool enabled = game.debug_test_players;
        if (igCheckbox("Cinco jogadores de teste", &enabled)) {
            golf_game_set_debug_test_players(enabled);
        }
        if (game.debug_test_players) {
            igText("Visual test only: additional balls are not simulated.");
            for (int i = 0; i < game.player_count; i++) {
                golf_player_t *player = &game.players[i];
                if (player->id == game.local_player_id) continue;
                igPushID_Int((int)player->id);
                igText("%s", player->name);
                float pos[3] = { player->ball.pos.x, player->ball.pos.y, player->ball.pos.z };
                if (igDragFloat3("Position", pos, 0.05f, -10000, 10000, "%.2f", 0)) {
                    player->ball.pos = V3(pos[0], pos[1], pos[2]);
                    player->ball.draw_pos = player->ball.pos;
                }
                igCheckbox("In water (visual)", &player->ball.is_in_water);
                igCheckbox("In hole (visual)", &player->ball.is_in_hole);
                igPopID();
            }
        }
    }
    static const char *contact_type_string[] = {
        "Point A", "Point B", "Point C",
        "Edge AB", "Edge AC", "Edge BC",
        "Face",
    };

    igCheckbox("Debug draw collisions", &game.physics.debug_draw_collisions);
    for (int i = 0; i < game.physics.collision_history.length; i++) {
        golf_collision_data_t *collision = &game.physics.collision_history.data[i]; 
        collision->is_highlighted = false;
        if (igTreeNodeEx_Ptr((void*)(intptr_t)i, ImGuiTreeNodeFlags_None, "Collision %d", i)) {
            collision->is_highlighted = true;
            for (int i = 0; i < collision->num_contacts; i++) {
                golf_ball_contact_t contact = collision->contacts[i];
                igText("Contact %d", i);
                igText("    Type: %s", contact_type_string[contact.type]);
                igText("    Ignored: %d", contact.is_ignored);
                igText("    Penetration: %0.2f", contact.penetration);
                igText("    Impulse Magnitude: %0.2f", contact.impulse_mag);
                igText("    Impulse: <%0.2f, %0.2f, %0.2f>", 
                        contact.impulse.x, contact.impulse.y, contact.impulse.z);
                igText("    Restitution: %0.2f", contact.restitution); 
                igText("    Velocity Scale: %0.2f", contact.vel_scale);
                igText("    Start Speed: %0.2f", vec3_length(contact.v0));
                igText("    End Speed: %0.2f", vec3_length(contact.v1));
                igText("    Start Velocity: <%0.2f, %0.2f, %0.2f>", 
                        contact.v0.x, contact.v0.y, contact.v0.z);
                igText("    End Velocity: <%0.2f, %0.2f, %0.2f>", 
                        contact.v1.x, contact.v1.y, contact.v1.z);
                igText("    Cull Dot: %0.2f", contact.cull_dot);
                igText("    Position: <%0.2f, %0.2f, %0.2f>",
                        contact.position.x, contact.position.y, contact.position.z);
                igText("    Normal: <%0.2f, %0.2f, %0.2f>",
                        contact.normal.x, contact.normal.y, contact.normal.z);
                igText("    Triangle Normal: <%0.2f, %0.2f, %0.2f>",
                        contact.triangle_normal.x, contact.triangle_normal.y, contact.triangle_normal.z);
            }
            igTreePop();
        }
        if (igIsItemHovered(ImGuiHoveredFlags_None)) {
            collision->is_highlighted = true;
        }
    }
}

static float _golf_game_get_camera_zone_angle(vec3 pos) {
    golf_player_t *player = golf_game_get_local_player();

    golf_camera_zone_entity_t camera_zone;
    if (golf_level_get_camera_zone(golf->level, pos, &camera_zone)) {
        vec3 camera_zone_dir;
        if (camera_zone.towards_hole) {
            camera_zone_dir = vec3_sub(game.hole_pos, player->ball.draw_pos);
            camera_zone_dir.y = 0;
            camera_zone_dir = vec3_normalize(camera_zone_dir);
        }
        else {
            camera_zone_dir = vec3_apply_quat(V3(1, 0, 0), 0, camera_zone.transform.rotation);
        }

        float camera_zone_angle = acosf(camera_zone_dir.x);
        if (camera_zone_dir.z > 0) camera_zone_angle *= -1;
        camera_zone_angle += MF_PI;

        return camera_zone_angle;
    }

    return game.cam.angle;
}

void golf_game_init(void) {
    memset(&game, 0, sizeof(game));

    golf_data_load("data/config/game.cfg", false);

    golf = golf_get();
    graphics = golf_graphics_get();
    inputs = golf_inputs_get();
    game_cfg = golf_data_get_config("data/config/game.cfg");

    game.state = GOLF_GAME_STATE_MAIN_MENU;
    game.cam.auto_rotate = true;
    game.cam.angle = 0;
    game.cam.angle_velocity = 0;

    game.player_count = 1;
    game.local_player_id = 1;
    golf_player_init(&game.players[0], game.local_player_id, "Player",
            V4(1, 1, 1, 1), 0);

    game.physics.time_behind = 0;
    game.physics.debug_draw_collisions = false;
    vec_init(&game.physics.collision_history, "physics");

    golf_bvh_init(&game.physics.static_bvh);
    golf_bvh_init(&game.physics.dynamic_bvh);

    game.aim_line.power = 0;
    game.aim_line.aim_delta = V2(0, 0);
    game.aim_line.offset = V2(0, 0);
    game.aim_line.num_points = 0;

    graphics->cam_pos = V3(5, 5, 5);
    graphics->cam_dir = vec3_normalize(V3(-5, -5, -5));
    graphics->cam_up = V3(0, 1, 0);

    for (int i = 0; i < MAX_NUM_WATER_RIPPLES; i++) {
        game.water_ripples[i].t0 = FLT_MAX;

        vec4 color = V4(0, 0, 0, 0);
        if (i % 4 == 0) {
            color = CFG_VEC4(game_cfg, "water_ripple_color_0");
        }
        else if (i % 4 == 1) {
            color = CFG_VEC4(game_cfg, "water_ripple_color_1");
        }
        else if (i % 4 == 2) {
            color = CFG_VEC4(game_cfg, "water_ripple_color_2");
        }
        else if (i % 4 == 3) {
            color = CFG_VEC4(game_cfg, "water_ripple_color_3");
        }
        game.water_ripples[i].color = color;
    }

    game.t = 0;

    golf_debug_console_add_tab("Game", _golf_game_debug_tab);
}

static void _golf_game_update_state_main_menu(float dt) {
    GOLF_UNUSED(dt);
}

static void _golf_game_update_state_waiting_for_aim(float dt) {
    golf_player_t *player = golf_game_get_local_player();

    GOLF_UNUSED(dt);

    if (player->ball.is_moving) {
        game.state = GOLF_GAME_STATE_WATCHING_BALL;
    }
}

static void _golf_game_update_state_aiming(float dt) {
    golf_player_t *player = golf_game_get_local_player();

    vec3 aim_direction = V3(game.aim_line.aim_delta.x, 0, game.aim_line.aim_delta.y);
    aim_direction = vec3_normalize(vec3_rotate_y(aim_direction, game.cam.angle - 0.5f * MF_PI));

    // Create aim line
    {
        game.aim_line.offset.x += -3 * dt;
        game.aim_line.num_points = 0;
        vec3 cur_point = player->ball.pos;
        vec3 cur_dir = aim_direction;
        float min_length = CFG_NUM(game_cfg, "aim_line_min_length");
        float max_length = CFG_NUM(game_cfg, "aim_line_max_length");
        max_length = min_length + game.aim_line.power * (max_length - min_length);
        float t = 0;
        while (true) {
            if (game.aim_line.num_points == MAX_AIM_LINE_POINTS) break;
            int idx = game.aim_line.num_points++;
            game.aim_line.points[idx] = cur_point;
            if (t >= max_length) break;

            golf_bvh_face_t static_hit_face;
            float static_hit_t = FLT_MAX;
            int static_hit_idx;
            golf_bvh_ray_test(&game.physics.static_bvh, cur_point, cur_dir, &static_hit_t, &static_hit_idx, &static_hit_face);

            golf_bvh_face_t dynamic_hit_face;
            float dynamic_hit_t = FLT_MAX;
            int dynamic_hit_idx;
            golf_bvh_ray_test(&game.physics.dynamic_bvh, cur_point, cur_dir, &dynamic_hit_t, &dynamic_hit_idx, &dynamic_hit_face);

            golf_bvh_face_t hit_face;
            float hit_t = FLT_MAX;

            if (static_hit_t < dynamic_hit_t) {
                hit_face = static_hit_face;
                hit_t = static_hit_t;
            }
            else if (dynamic_hit_t < static_hit_t) {
                hit_face = dynamic_hit_face;
                hit_t = dynamic_hit_t;
            }

            if (hit_t < FLT_MAX) {
                if (t + hit_t > max_length) {
                    hit_t = max_length - t;
                    t = max_length;
                }
                
                vec3 normal = vec3_normalize(vec3_cross(vec3_sub(hit_face.b, hit_face.a), vec3_sub(hit_face.c, hit_face.a)));
                cur_point = vec3_add(cur_point, vec3_scale(cur_dir, hit_t));
                cur_point = vec3_add(cur_point, vec3_scale(cur_dir, -0.095f));
                cur_dir = vec3_reflect_with_restitution(cur_dir, normal, 1);
                t += hit_t;
            }
            else {
                cur_point = vec3_add(cur_point, vec3_scale(cur_dir, max_length - t));
                t = max_length;
            }
        }
    }

    if (player->ball.is_moving) {
        game.state = GOLF_GAME_STATE_WATCHING_BALL;
    }
}

static void _golf_game_update_state_watching_ball(float dt) {
    golf_player_t *player = golf_game_get_local_player();

    GOLF_UNUSED(dt);

    if (player->ball.is_in_hole) {
        player->ball.vel = V3(0, 0, 0);
        player->ball.is_moving = false;

        game.state = GOLF_GAME_STATE_CELEBRATION;
        game.celebration.t = 0;
        game.celebration.cam_pos0 = graphics->cam_pos;
        game.celebration.cam_dir0 = graphics->cam_dir;
        game.celebration.cam_pos1 = vec3_add(graphics->cam_pos, vec3_scale(graphics->cam_dir, -1.5f));
        game.celebration.cam_dir1 = vec3_normalize(vec3_sub(player->ball.draw_pos, game.celebration.cam_pos1));

        {
            char storage_key[256];
            snprintf(storage_key, 256, "stroke_count_level_%d", golf->level_num);

            float storage_stroke_count;
            bool is_key_set = golf_storage_get_num(storage_key, &storage_stroke_count); 
            if (!is_key_set || player->stroke_count < (int)storage_stroke_count) {
                golf_storage_set_num(storage_key, (float)player->stroke_count);
            }
            golf_storage_save();
        }

        golf_audio_start_sound("ball_in_hole", "data/audio/confirmation_002.ogg", 1, false, true);
    }
    else if (player->ball.is_out_of_bounds) {
        player->ball.pos = player->ball.start_pos;
        player->ball.draw_pos = player->ball.pos;
        player->ball.is_moving = false;
        player->ball.vel = V3(0, 0, 0);
        player->ball.rot_vel = 0;
        player->ball.orientation = QUAT(0, 0, 0, 1);
        player->ball.is_out_of_bounds = 0;
        game.cam.angle = game.cam.start_angle;
        game.cam.auto_rotate = false;
        game.state = GOLF_GAME_STATE_WAITING_FOR_AIM;
        golf_audio_start_sound("ball_out_of_bounds", "data/audio/error_008.ogg", 1, false, true);
    }
    else if (!player->ball.is_moving) {
        game.state = GOLF_GAME_STATE_WAITING_FOR_AIM;
    }
}

static void _physics_contacts(vec3 pos, golf_ball_contact_t *contacts, int count) {
    if (!game.physics.debug_draw_collisions || game.physics.collision_history.length >= 2048) return;
    golf_collision_data_t collision = {0};
    collision.ball_pos = pos;
    collision.num_contacts = count;
    for (int i = 0; i < count; i++) collision.contacts[i] = contacts[i];
    vec_push(&game.physics.collision_history, collision);
}
static void _physics_ripple(vec3 pos) {
    for (int i = 0; i < MAX_NUM_WATER_RIPPLES; i++) {
        if (game.water_ripples[i].t0 < FLT_MAX) continue;
        game.water_ripples[i].t0 = game.t;
        game.water_ripples[i].pos = pos;
        break;
    }
}
static golf_physics_world_t _physics_world(void) {
    golf_physics_world_t world = {0};
    world.level = golf->level;
    world.config = game_cfg;
    world.static_bvh = &game.physics.static_bvh;
    world.dynamic_bvh = &game.physics.dynamic_bvh;
    world.time = game.t;
    world.sound = golf_audio_start_sound;
    world.stop_sound = golf_audio_stop_sound;
    world.ripple = _physics_ripple;
    world.contacts = _physics_contacts;
    return world;
}

void golf_game_update(float dt) {
    golf_player_t *player = golf_game_get_local_player();

    if (game.state == GOLF_GAME_STATE_PAUSED) {
        return;
    }

    if (!golf_online_active()) game.t += dt;

    switch (game.state) {
        case GOLF_GAME_STATE_MAIN_MENU:
            _golf_game_update_state_main_menu(dt);
            break;
        case GOLF_GAME_STATE_WAITING_FOR_AIM:
            _golf_game_update_state_waiting_for_aim(dt);
            break;
        case GOLF_GAME_STATE_AIMING:
            _golf_game_update_state_aiming(dt);
            break;
        case GOLF_GAME_STATE_WATCHING_BALL:
            if (!golf_online_active()) _golf_game_update_state_watching_ball(dt);
            break;
        case GOLF_GAME_STATE_BEGIN_CAMERA_ANIMATION:
        case GOLF_GAME_STATE_CELEBRATION:
        case GOLF_GAME_STATE_FINISHED:
        case GOLF_GAME_STATE_PAUSED:
            break;
    }

    {
        // Remove any water ripples that have finished
        float time_length = CFG_NUM(game_cfg, "water_ripple_time_length"); 
        for (int i = 0; i < MAX_NUM_WATER_RIPPLES; i++) {
            if (game.water_ripples[i].t0 == FLT_MAX) {
                continue;
            }

            float dt = game.t - game.water_ripples[i].t0;
            if (dt > time_length) {
                game.water_ripples[i].t0 = FLT_MAX;
            }
        }
    }

    if (game.state > GOLF_GAME_STATE_MAIN_MENU && !golf_online_active()) {
        float physics_dt = 1.0f/120.0f;
        game.physics.time_behind += dt;

        vec3 bp_prev = player->ball.pos;
        int num_ticks = 0;
        while (game.physics.time_behind >= 0 && num_ticks < 5) {
            bp_prev = player->ball.pos;
            golf_physics_world_t world = _physics_world();
            golf_physics_build_world(&world, true);
            golf_physics_tick_player(&world, player, physics_dt);
            game.physics.time_behind -= physics_dt;
            num_ticks++;
        }
        while (game.physics.time_behind >= 0) {
            game.physics.time_behind -= physics_dt;
        }

        float alpha = (float)(-game.physics.time_behind / physics_dt);
        player->ball.draw_pos = vec3_add(vec3_scale(player->ball.pos, 1.0f - alpha), vec3_scale(bp_prev, alpha));
    }

    if (golf_online_active()) {
        golf_physics_world_t world = _physics_world();
        golf_physics_build_world(&world, true);
        player = golf_online_camera_player();
    }

    // Move around the camera
    switch (game.state) {
        case GOLF_GAME_STATE_BEGIN_CAMERA_ANIMATION: {
            vec3 cam_pos0 = game.begin_camera_animation.cam_pos0;
            vec3 cam_pos1 = game.begin_camera_animation.cam_pos1;
            vec3 cam_dir0 = game.begin_camera_animation.cam_dir0;
            vec3 cam_dir1 = game.begin_camera_animation.cam_dir1;
            float t = game.begin_camera_animation.t;
            float length0 = CFG_NUM(game_cfg, "begin_camera_animation_length0");
            float length1 = CFG_NUM(game_cfg, "begin_camera_animation_length1");

            if (t >= length0) {
                t = t - length0;
                float a = sinf(0.5f * MF_PI * t / length1);

                graphics->cam_pos = vec3_add(vec3_scale(cam_pos0, 1 - a), vec3_scale(cam_pos1, a));
                graphics->cam_dir = vec3_normalize(vec3_add(vec3_scale(cam_dir0, 1 - a), vec3_scale(cam_dir1, a)));

                if (t >= length1) {
                    game.state = GOLF_GAME_STATE_WAITING_FOR_AIM;
                    graphics->cam_pos = cam_pos1;
                    graphics->cam_dir = cam_dir1;
                }
            }

            game.begin_camera_animation.t += dt;
            break;
        }
        case GOLF_GAME_STATE_CELEBRATION: {
            vec3 cam_pos0 = game.celebration.cam_pos0;
            vec3 cam_pos1 = game.celebration.cam_pos1;
            vec3 cam_dir0 = game.celebration.cam_dir0;
            vec3 cam_dir1 = game.celebration.cam_dir1;

            float t = game.celebration.t;
            float length = CFG_NUM(game_cfg, "celebration_length");
            float a = sinf(0.5f * MF_PI * t / length);

            graphics->cam_pos = vec3_add(cam_pos0, vec3_scale(vec3_sub(cam_pos1, cam_pos0), a));
            graphics->cam_dir = vec3_add(cam_dir0, vec3_scale(vec3_sub(cam_dir1, cam_dir0), a));

            if (t >= length) {
                game.state = GOLF_GAME_STATE_FINISHED;
            }

            game.celebration.t += dt;
            break;
        }
        case GOLF_GAME_STATE_WAITING_FOR_AIM:
        case GOLF_GAME_STATE_AIMING:
        case GOLF_GAME_STATE_WATCHING_BALL: {
            if (game.cam.auto_rotate) {
                float camera_zone_angle = _golf_game_get_camera_zone_angle(player->ball.draw_pos);
                float delta_angle = camera_zone_angle - game.cam.angle;
                delta_angle = atan2f(sinf(delta_angle), cosf(delta_angle));
                game.cam.angle += delta_angle * CFG_NUM(game_cfg, "cam_auto_rotate_speed");
            }

            vec3 cam_delta = vec3_rotate_y(V3(2.6f, 1.5f, 0), game.cam.angle);
            vec3 wanted_pos = vec3_add(player->ball.draw_pos, cam_delta);
            vec3 diff = vec3_sub(wanted_pos, graphics->cam_pos);
            graphics->cam_pos = vec3_add(graphics->cam_pos, vec3_scale(diff, 0.5f));
            graphics->cam_dir = vec3_normalize(vec3_sub(vec3_add(player->ball.draw_pos, V3(0, 0.3f, 0)), graphics->cam_pos));
            break;
        }
        case GOLF_GAME_STATE_MAIN_MENU:
        case GOLF_GAME_STATE_PAUSED:
        case GOLF_GAME_STATE_FINISHED: 
            break;
    }
}

void golf_game_start_main_menu(void) {
    golf_game_set_debug_test_players(false);
    golf_player_t *player = golf_game_get_local_player();

    game.state = GOLF_GAME_STATE_MAIN_MENU;

    vec3 hole_pos = V3(0, 0, 0);;
    vec3 begin_animation_pos = V3(0, 0, 0);

    golf_level_t *level = golf->level;
    for (int i = 0; i < level->entities.length; i++) {
        golf_entity_t *entity = &level->entities.data[i];
        switch (entity->type) {
            case CAMERA_ZONE_ENTITY:
            case MODEL_ENTITY:
            case GEO_ENTITY:
            case GROUP_ENTITY:
            case WATER_ENTITY:
            case BALL_START_ENTITY:
                break;
            case HOLE_ENTITY:
                hole_pos = entity->hole.transform.position;
                break;
            case BEGIN_ANIMATION_ENTITY:
                begin_animation_pos = entity->begin_animation.transform.position;
                break;
        }
    }

    player->ball.pos = V3(99999.0f, 99999.0f, 99999.0f);
    player->ball.draw_pos = player->ball.pos;
    player->ball.vel = V3(0, 0, 0);

    graphics->cam_pos = begin_animation_pos;
    graphics->cam_dir = vec3_normalize(vec3_sub(hole_pos, begin_animation_pos));
}

void golf_game_start_level(void) {
    golf_player_t *player = golf_game_get_local_player();

    game.state = GOLF_GAME_STATE_BEGIN_CAMERA_ANIMATION;

    vec3 ball_start_pos = V3(0, 0, 0);
    vec3 hole_pos = V3(0, 0, 0);
    vec3 begin_animation_pos = V3(0, 0, 0);

    golf_level_t *level = golf->level;
    for (int i = 0; i < level->entities.length; i++) {
        golf_entity_t *entity = &level->entities.data[i];
        switch (entity->type) {
            case CAMERA_ZONE_ENTITY:
            case MODEL_ENTITY:
            case GEO_ENTITY:
            case GROUP_ENTITY:
            case WATER_ENTITY:
                break;
            case HOLE_ENTITY:
                hole_pos = entity->hole.transform.position;
                break;
            case BALL_START_ENTITY:
                ball_start_pos = entity->ball_start.transform.position;
                ball_start_pos.y += player->ball.radius;
                break;
            case BEGIN_ANIMATION_ENTITY:
                begin_animation_pos = entity->begin_animation.transform.position;
                break;
        }
    }

    golf_physics_world_t world = _physics_world();
    world.time = 0;
    golf_physics_build_world(&world, false);

    game.t = 0;

    game.ball_start_pos = ball_start_pos;
    game.hole_pos = hole_pos;
    golf_player_start_level(player, ball_start_pos);
    if (game.debug_test_players) {
        for (int i = 0; i < game.player_count; i++) {
            if (game.players[i].id != game.local_player_id) {
                golf_player_start_level(&game.players[i], ball_start_pos);
            }
        }
    }

    game.cam.auto_rotate = true;
    game.cam.angle = _golf_game_get_camera_zone_angle(ball_start_pos);
    game.cam.angle_velocity = 0;

    game.physics.time_behind = 0;

    game.aim_line.power = 0;
    game.aim_line.aim_delta = V2(0, 0);
    game.aim_line.offset = V2(0, 0);
    game.aim_line.num_points = 0;

    game.begin_camera_animation.t = 0;
    game.begin_camera_animation.cam_pos0 = begin_animation_pos;
    game.begin_camera_animation.cam_dir0 = vec3_normalize(vec3_sub(hole_pos, game.begin_camera_animation.cam_pos0));

    vec3 cam_delta = vec3_rotate_y(V3(2.6f, 1.5f, 0), game.cam.angle);
    game.begin_camera_animation.cam_pos1 = vec3_add(player->ball.draw_pos, cam_delta);
    game.begin_camera_animation.cam_dir1 = vec3_normalize(vec3_sub(vec3_add(player->ball.draw_pos, V3(0, 0.3f, 0)), game.begin_camera_animation.cam_pos1));

    graphics->cam_pos = game.begin_camera_animation.cam_pos0;
    graphics->cam_dir = game.begin_camera_animation.cam_dir0;
}

void golf_game_start_aiming(void) {
    if (golf_online_active() && !golf_online_can_shoot()) return;
    game.state = GOLF_GAME_STATE_AIMING;
    game.aim_line.num_points = 0;
}

void golf_game_stop_aiming(void) {
    game.state = GOLF_GAME_STATE_WAITING_FOR_AIM;
}

void golf_game_hit_ball(vec2 aim_delta) {
    golf_player_t *player = golf_game_get_local_player();

    if (golf_online_active()) {
        vec3 direction = vec3_normalize(vec3_rotate_y(V3(aim_delta.x, 0, aim_delta.y), game.cam.angle - .5f * MF_PI));
        golf_online_shoot(direction, game.aim_line.power);
        return;
    }
    game.state = GOLF_GAME_STATE_WATCHING_BALL;
    player->stroke_count++;

    vec3 aim_direction = V3(aim_delta.x, 0, aim_delta.y);
    aim_direction = vec3_normalize(vec3_rotate_y(aim_direction, game.cam.angle - 0.5f * MF_PI));

    float green_power = CFG_NUM(game_cfg, "aim_green_power");
    float yellow_power = CFG_NUM(game_cfg, "aim_yellow_power");
    float red_power = CFG_NUM(game_cfg, "aim_red_power");
    float green_speed = CFG_NUM(game_cfg, "aim_green_speed");
    float yellow_speed = CFG_NUM(game_cfg, "aim_yellow_speed");
    float red_speed = CFG_NUM(game_cfg, "aim_red_speed");
    float dark_red_speed = CFG_NUM(game_cfg, "aim_dark_red_speed");
    float start_speed = 0;
    float p = game.aim_line.power;
    if (p < green_power) {
        float a = p / green_power;
        start_speed = green_speed + (yellow_speed - green_speed) * a;
    }
    else if (p < yellow_power) {
        float a = (p - green_power) / (yellow_power - green_power);
        start_speed = yellow_speed + (red_speed - yellow_speed) * a;
    }
    else if (p < red_power) {
        float a = (p - yellow_power) / (red_power - yellow_power);
        start_speed = red_speed + (dark_red_speed - red_speed) * a;
    }
    else {
        start_speed = dark_red_speed;
    }

    game.cam.auto_rotate = true;

    player->ball.vel = vec3_scale(aim_direction, start_speed);
    player->ball.is_moving = true;
    player->ball.start_pos = player->ball.pos;
    game.cam.start_angle = game.cam.angle;

    game.physics.collision_history.length = 0;

    golf_audio_start_sound("hit_ball", "data/audio/impactPlank_medium_000.ogg", 1, false, true);
}

void golf_game_pause(void) {
    game.state_before_pause = game.state;
    game.state = GOLF_GAME_STATE_PAUSED;
}

void golf_game_resume(void) {
    game.state = game.state_before_pause;
}
