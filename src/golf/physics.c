#include "golf/physics.h"
#include <float.h>
#include <math.h>
#include <stdlib.h>

static int _ball_contact_cmp(const void *a, const void *b) {
    const golf_ball_contact_t *bc0 = (golf_ball_contact_t*)a;
    const golf_ball_contact_t *bc1 = (golf_ball_contact_t*)b;

    if (bc1->distance > bc0->distance) {
        return -1;
    }
    else if (bc1->distance < bc0->distance) {
        return 1;
    }
    else if (bc1->vel_scale > bc0->vel_scale) {
        return 1;
    }
    else if (bc1->vel_scale < bc0->vel_scale) {
        return -1;
    }
    else if (bc1->restitution > bc0->restitution) {
        return -1;
    }
    else if (bc1->restitution < bc0->restitution) {
        return 1;
    }
    else {
        return 0;
    }
}
static const char *collision_kind(golf_physics_world_t *world,golf_ball_contact_t *contact){
    golf_bvh_t *trees[]={world->static_bvh,world->dynamic_bvh};
    for(int t=0;t<2;t++)for(int i=0;i<trees[t]->faces.length;i++){
        golf_bvh_face_t *f=&trees[t]->faces.data[i];if(vec3_distance(f->a,contact->triangle_a)>.001f||vec3_distance(f->b,contact->triangle_b)>.001f)continue;
        if(f->entity->type==MODEL_ENTITY){const char *path=f->entity->model.model_path;return strstr(path,"stone")||strstr(path,"rock")?"stone":"wood";}
        if(f->entity->type==GEO_ENTITY)for(int j=0;j<f->entity->geo.geo.faces.length;j++){
            golf_material_t material;if(!golf_level_get_material(world->level,f->entity->geo.geo.faces.data[j].material_name,&material))continue;
            if(fabsf(material.restitution-contact->restitution)<.001f&&fabsf(material.vel_scale-contact->vel_scale)<.001f){
                if(strstr(material.texture_path,"wood")||strstr(material.name,"wood"))return "wood";
                if(strstr(material.texture_path,"stone")||strstr(material.texture_path,"rock"))return "stone";
            }
        }
        return "stone";
    }
    return "stone";
}

void golf_physics_build_world(golf_physics_world_t *world, bool dynamic) {
    golf_bvh_t *bvh = dynamic ? world->dynamic_bvh : world->static_bvh;
    bvh->node_infos.length = 0;
    bvh->faces.length = 0;
    for (int i = 0; i < world->level->entities.length; i++) {
        golf_entity_t *entity = &world->level->entities.data[i];
        if (entity->type != MODEL_ENTITY && entity->type != GEO_ENTITY && entity->type != WATER_ENTITY) continue;
        if (entity->type == MODEL_ENTITY && entity->model.ignore_physics) continue;
        golf_movement_t *movement = golf_entity_get_movement(entity);
        bool moving = movement && movement->type != GOLF_MOVEMENT_NONE;
        if (moving == dynamic) vec_push(&bvh->node_infos, golf_bvh_node_info(bvh, i, world->level, entity, world->time));
    }
    golf_bvh_construct(bvh, bvh->node_infos);
}

/* Sweep through the cup, so an off-center or fast descending ball cannot miss
 * the trigger between ticks. The capture volume stays below the lip and
 * inside the physical opening; balls rolling past or flying above do not score. */
static bool _capture_in_cup(golf_physics_world_t *world, golf_entity_t *hole,
        vec3 from, vec3 to, float ball_radius, vec3 *position) {
    if (!hole) return false;
    golf_transform_t transform=golf_entity_get_world_transform(world->level,hole);
    vec3 center=transform.position;
    float opening=fminf(fabsf(transform.scale.x),fabsf(transform.scale.z));
    float radius=fminf(world->capture_radius,opening-ball_radius*.5f);
    float top=center.y-ball_radius*.5f;
    float bottom=center.y-2*fabsf(transform.scale.y)+ball_radius;
    if (radius<=0 || bottom>=top) return false;

    float enter=0,leave=1;
    vec3 delta=vec3_sub(to,from);
    if (fabsf(delta.y)<EPSILON) {
        if (from.y<bottom || from.y>top) return false;
    } else {
        float a=(bottom-from.y)/delta.y,b=(top-from.y)/delta.y;
        enter=fmaxf(enter,fminf(a,b));leave=fminf(leave,fmaxf(a,b));
        if (enter>leave) return false;
    }
    vec3 relative=vec3_sub(from,center);
    float length_squared=delta.x*delta.x+delta.z*delta.z;
    float t=length_squared>EPSILON*EPSILON
        ? golf_clampf(-(relative.x*delta.x+relative.z*delta.z)/length_squared,enter,leave) : enter;
    vec3 hit=vec3_add(from,vec3_scale(delta,t));
    float x=hit.x-center.x,z=hit.z-center.z;
    if (x*x+z*z>radius*radius) return false;
    /* Keep ordinary descent continuous; clamp only a step that crossed the cup. */
    x=to.x-center.x;z=to.z-center.z;
    *position=to.y>=bottom && to.y<=top && x*x+z*z<=radius*radius ? to : hit;
    return true;
}

static bool moving_contact(golf_physics_world_t *world,const golf_ball_t *ball){
    golf_ball_contact_t contacts[1];int count=0;
    golf_bvh_ball_test(world->dynamic_bvh,ball->pos,ball->radius+.05f,ball->vel,contacts,&count,1);
    return count>0;
}
void golf_physics_tick_player(golf_physics_world_t *world, golf_player_t *player, float dt) {
    if (player->ball.is_in_hole || player->ball.capture_until>0) return;
    golf_ball_t *ball=&player->ball;
    static int full_rest=-1;if(full_rest<0)full_rest=getenv("GOLF_PHYSICS_FULL_REST")!=NULL;
    if(ball->resting_static&&dt==ball->resting_dt&&!ball->is_moving&&!ball->is_in_water&&!ball->is_out_of_bounds&&
       ball->pos.x==ball->resting_pos.x&&ball->pos.y==ball->resting_pos.y&&ball->pos.z==ball->resting_pos.z&&
       ball->vel.x==ball->resting_vel.x&&ball->vel.y==ball->resting_vel.y&&ball->vel.z==ball->resting_vel.z&&
       !full_rest&&!moving_contact(world,ball)){
        ball->time_going_slow+=dt;ball->time_since_impact_sound+=dt;ball->time_out_of_water+=dt;
        return;
    }
    ball->resting_static=false;
    bool started_moving=ball->is_moving;
    float EPS = 0.001f;

    vec3 bp = player->ball.pos;
    float br = player->ball.radius;
    vec3 bv = player->ball.vel;
    float bs = vec3_length(bv);
    vec3 bp0 = bp;
    vec3 bv0 = bv;

    float dist_to_hole = FLT_MAX;
    vec3 dir_to_hole = V3(0, 0, 0);
    vec3 hole_pos = V3(0, 0, 0);
    golf_entity_t *close_hole = NULL;
    golf_entity_t *nearest_hole = NULL;
    for (int i = 0; i < world->level->entities.length; i++) {
        golf_entity_t *entity = &world->level->entities.data[i];
        if (entity->type == HOLE_ENTITY) {
            golf_transform_t transform=golf_entity_get_world_transform(world->level,entity);
            vec3 hp = transform.position;
            vec3 hs = transform.scale;
            float dist = vec3_distance(hp, bp);
            float x=bp.x-hp.x,z=bp.z-hp.z;
            bool inside_cup=world->multiplayer &&
                x*x+z*z<=fminf(fabsf(hs.x),fabsf(hs.z))*fminf(fabsf(hs.x),fabsf(hs.z)) &&
                bp.y<=hp.y+br && bp.y>=hp.y-2*fabsf(hs.y)-br;
            if (inside_cup || (!world->multiplayer && dist <= hs.x)) {
                close_hole = entity;
            }
            if (dist < dist_to_hole) {
                dist_to_hole = dist;
                dir_to_hole = vec3_normalize(vec3_sub(hp, bp));
                hole_pos = hp;
                nearest_hole = entity;
            }
        }
    }

    int num_contacts = 0;
    golf_ball_contact_t contacts[MAX_NUM_CONTACTS];
    if (close_hole) {
        golf_model_t *model = golf_entity_get_model(close_hole);
        golf_transform_t transform = golf_entity_get_world_transform(world->level, close_hole);
        mat4 model_mat = golf_transform_get_model_mat(transform);
        for (int i = 0; i < model->positions.length; i += 3) {
            vec3 a = vec3_apply_mat4(model->positions.data[i + 0], 1, model_mat);
            vec3 b = vec3_apply_mat4(model->positions.data[i + 1], 1, model_mat);
            vec3 c = vec3_apply_mat4(model->positions.data[i + 2], 1, model_mat);
            triangle_contact_type_t type;
            vec3 cp = closest_point_point_triangle(bp, a, b, c, &type);
            float dist = vec3_distance(bp, cp);
            if (dist < br) {
                float restitution, friction, vel_scale;
                if (type == TRIANGLE_CONTACT_AB || type == TRIANGLE_CONTACT_AC || type == TRIANGLE_CONTACT_BC) {
                    restitution = 0.4f;
                    if (bs > 2) {
                        friction = 1;
                        vel_scale = 0.95f;
                    }
                    else {
                        friction = 0;
                        vel_scale = 1;
                    }
                }
                else {
                    restitution = 0.5f;
                    friction = 0.5f;
                    vel_scale = 1;
                }
                if (num_contacts < MAX_NUM_CONTACTS) {
                    vec3 vel = V3(0, 0, 0);
                    golf_ball_contact_t contact = golf_ball_contact(a, b, c, vel, bp, br, cp, dist, restitution, friction, vel_scale, type, false, V3(0, 0, 0), false);
                    contacts[num_contacts] = contact;
                    num_contacts = num_contacts + 1;
                }
            }
        }
    }
    else {
        golf_bvh_ball_test(world->static_bvh, bp, br, bv, contacts, &num_contacts, MAX_NUM_CONTACTS);
        golf_bvh_ball_test(world->dynamic_bvh, bp, br, bv, contacts, &num_contacts, MAX_NUM_CONTACTS);
    }
    qsort(contacts, num_contacts, sizeof(golf_ball_contact_t), _ball_contact_cmp);
    /* A submerged recovery plane is a trigger, not a river bed. Its material
       can otherwise erase horizontal velocity before the current is applied. */
    bool water_support=false;
    for(int i=0;i<num_contacts;i++)if(contacts[i].is_water&&
        contacts[i].water_dir.x*contacts[i].water_dir.x+
        contacts[i].water_dir.z*contacts[i].water_dir.z>1.e-10f)water_support=true;
    if(water_support)for(int i=0;i<num_contacts;i++)
        if(contacts[i].is_out_of_bounds&&!contacts[i].is_water)contacts[i].is_ignored=true;

    // Apply a force to pull the ball towards the hole
    vec3 horizontal = dir_to_hole;
    horizontal.y = 0;
    float planar_distance = vec3_length(vec3_sub(V3(bp.x, hole_pos.y, bp.z), hole_pos));
    if (world->multiplayer && nearest_hole && planar_distance < world->funnel_radius &&
            fabsf(bp.y - hole_pos.y) < 0.25f && bs <= world->capture_max_speed) {
        if (planar_distance > EPS) {
            /* A radial impulse fades at the rim and is capped near the center. */
            float force = world->funnel_force * (1 - planar_distance / world->funnel_radius);
            bv = vec3_add(bv, vec3_scale(vec3_normalize(horizontal), force * dt * 120));
        }
    }
    else if (!world->multiplayer && dist_to_hole < CFG_NUM(world->config, "physics_hole_force_distance") && num_contacts > 0) {
        float hole_force = CFG_NUM(world->config, "physics_hole_force");
        bv = vec3_add(bv, vec3_scale(dir_to_hole, hole_force));
    }

    // Filter out the contacts
    {
        int num_processed_vertices = 0;
        vec3 processed_vertices[9 * MAX_NUM_CONTACTS];

        // All face contacts are used
        for (int i = 0; i < num_contacts; i++) {
            golf_ball_contact_t *contact = &contacts[i];
            if (contact->is_ignored || contact->type != TRIANGLE_CONTACT_FACE) {
                continue;
            }

            processed_vertices[num_processed_vertices++] = contact->triangle_a;
            processed_vertices[num_processed_vertices++] = contact->triangle_b;
            processed_vertices[num_processed_vertices++] = contact->triangle_c;
        }

        // Remove unecessary edge contacts
        for (int i = 0; i < num_contacts; i++) {
            golf_ball_contact_t *contact = &contacts[i];
            if (contact->is_ignored || 
                    (contact->type != TRIANGLE_CONTACT_AB && 
                     contact->type != TRIANGLE_CONTACT_AC &&
                     contact->type != TRIANGLE_CONTACT_BC)) {
                continue;
            }

            vec3 e0 = V3(0, 0, 0);
            vec3 e1 = V3(0, 0, 0);
            if (contact->type == TRIANGLE_CONTACT_AB) {
                e0 = contact->triangle_a;
                e1 = contact->triangle_b;
            }
            else if (contact->type == TRIANGLE_CONTACT_AC) {
                e0 = contact->triangle_a;
                e1 = contact->triangle_c;
            }
            else if (contact->type == TRIANGLE_CONTACT_BC) {
                e0 = contact->triangle_b;
                e1 = contact->triangle_c;
            }

            for (int j = 0; j < num_processed_vertices; j += 3) {
                vec3 a = processed_vertices[j + 0];
                vec3 b = processed_vertices[j + 1];
                vec3 c = processed_vertices[j + 2];
                if (vec3_line_segments_on_same_line(a, b, e0, e1, EPS) ||
                        vec3_line_segments_on_same_line(a, c, e0, e1, EPS) ||
                        vec3_line_segments_on_same_line(b, c, e0, e1, EPS)) {
                    contact->is_ignored = true;
                    break;
                }
            }

            processed_vertices[num_processed_vertices++] = contact->triangle_a;
            processed_vertices[num_processed_vertices++] = contact->triangle_b;
            processed_vertices[num_processed_vertices++] = contact->triangle_c;
        }

        // Remove uncessary point contacts
        for (int i = 0; i < num_contacts; i++) {
            golf_ball_contact_t *contact = &contacts[i];
            if (contact->is_ignored ||
                    (contact->type != TRIANGLE_CONTACT_A && 
                     contact->type != TRIANGLE_CONTACT_B &&
                     contact->type != TRIANGLE_CONTACT_C)) {
                continue;
            }

            vec3 p = V3(0, 0, 0);
            if (contact->type == TRIANGLE_CONTACT_A) {
                p = contact->triangle_a;
            }
            else if (contact->type == TRIANGLE_CONTACT_B) {
                p = contact->triangle_b;
            }
            else if (contact->type == TRIANGLE_CONTACT_C) {
                p = contact->triangle_c;
            }

            for (int j = 0; j + 2 < num_processed_vertices; j += 3) {
                vec3 a = processed_vertices[j + 0];
                vec3 b = processed_vertices[j + 1];
                vec3 c = processed_vertices[j + 2];
                if (vec3_point_on_line_segment(p, a, b, EPS) ||
                        vec3_point_on_line_segment(p, a, c, EPS) ||
                        vec3_point_on_line_segment(p, b, c, EPS)) {
                    contact->is_ignored = true;
                    break;
                }
            }

            processed_vertices[num_processed_vertices++] = contact->triangle_a;
            processed_vertices[num_processed_vertices++] = contact->triangle_b;
            processed_vertices[num_processed_vertices++] = contact->triangle_c;
        }
    }

    for (int i = 0; i < num_contacts; i++) {
        golf_ball_contact_t *contact = &contacts[i];
        if (contact->is_ignored) {
            continue;
        }
        if (contact->is_water) {
            continue;
        }

        vec3 n = contact->normal;
        vec3 vr = vec3_sub(bv, contact->velocity);
        contact->cull_dot = vec3_dot(n, vec3_normalize(vr));
        if (contact->cull_dot > EPS) {
            contact->is_ignored = true;
            continue;
        }

        float e = contact->restitution;
        float v_scale = contact->vel_scale;
        float imp = -(1 + e) * vec3_dot(vr, n);

        contact->impulse_mag = imp; 
        contact->impulse = vec3_scale(n, imp);
        contact->v0 = bv0;

        bv = vec3_add(bv, contact->impulse);
        bv = vec3_scale(bv, v_scale);

        player->ball.rot_vel = vec3_length(bv) / (MF_PI * player->ball.radius);
        player->ball.rot_vec = vec3_normalize(vec3_cross(n, bv));

        vec3 t = vec3_sub(bv, vec3_scale(n, vec3_dot(bv, n)));
        if (vec3_length(t) > EPS) {
            t = vec3_normalize(t);

            float jt = -vec3_dot(vr, t);
            if (fabsf(jt) > EPS) {
                float friction = contact->friction;
                if (jt > imp * friction) {
                    jt = imp * friction;
                }
                else if (jt < -imp * friction) {
                    jt = -imp * friction;
                }

                bv = vec3_add(bv, vec3_scale(t, jt));
            }
        }

        contact->v1 = bv;

        if (contact->impulse_mag > 1 && contact->cull_dot < -0.15f) {
            if (player->ball.time_since_impact_sound > 0.1f) {
                if (world->sound) world->sound(collision_kind(world,contact), "data/audio/footstep_grass_004.ogg", golf_clampf(contact->impulse_mag/8,.15f,1), false, true);
                player->ball.time_since_impact_sound = 0;
            }
        }
    }
    player->ball.time_since_impact_sound += dt;

    float gravity = -9.8f;
    bv = vec3_add(bv, V3(0, gravity * dt, 0));
    bp = vec3_add(bp, vec3_scale(bv, dt));

    for (int i = 0; i < num_contacts; i++) {
        golf_ball_contact_t *contact = &contacts[i];
        if (contact->is_ignored) {
            continue;
        }
        if (contact->is_water) {
            continue;
        }

        float pen = fmaxf(contact->penetration, 0);
        vec3 correction = vec3_scale(contact->normal, pen * 0.5f);
        bp = vec3_add(bp, correction);
    }

    player->ball.is_in_water = false;
    vec3 current=V3(0,0,0);
    int water_contacts=0;
    float water_surface=-FLT_MAX;
    for (int i = 0; i < num_contacts; i++) {
        golf_ball_contact_t *contact = &contacts[i];
        if (contact->is_ignored) {
            continue;
        }
        if (!contact->is_water) {
            continue;
        }

        /* Directions are transformed with the water mesh. Normalize away entity
           scale, then blend the local flow at bends before applying ONE force.
           Triangle seams must not multiply acceleration or damp gravity. */
        vec3 direction=contact->water_dir;direction.y=0;
        float length=vec3_length(direction);
        if(length>.00001f)current=vec3_add(current,vec3_scale(direction,1/length));
        water_contacts++;
        player->ball.is_in_water = true;
        /* Water must support the ball, including original rivers with no bed.
           Only face contacts support it; banks retain their solid collisions. */
        if(length>.00001f&&contact->type==TRIANGLE_CONTACT_FACE&&fabsf(contact->normal.y)>.5f)
            water_surface=fmaxf(water_surface,contact->position.y);
    }
    if(water_contacts){
        float length=vec3_length(current);
        if(length>.00001f)current=vec3_scale(current,CFG_NUM(world->config,"physics_water_max_speed")/length);
        /* Respond quickly enough to a bend to avoid coasting across its bank. */
        float blend=1-expf(-3*fmaxf(0,CFG_NUM(world->config,"physics_water_speed"))*dt);
        bv.x+=(current.x-bv.x)*blend;bv.z+=(current.z-bv.z)*blend;
        if(water_surface>-FLT_MAX&&bv0.y<=.1f){
            bp.y=fmaxf(bp.y,water_surface+br*.5f);bv.y=0;
        }
        if(water_support)player->ball.is_out_of_bounds=false;
    }

    if (player->ball.is_moving && num_contacts > 0 && world->contacts) {
        world->contacts(bp0, contacts, num_contacts);
    }

    if (vec3_length(bv) < 0.1f) {
        player->ball.time_going_slow += dt;
    }
    else {
        player->ball.time_going_slow = 0.0f;
    }

    if (!player->ball.is_moving && vec3_length(bv) > 0.1f) {
        player->ball.is_moving = true;
    }
    if (player->ball.is_moving) {
        player->ball.pos = bp;
        player->ball.vel = bv;
        player->ball.rot_vel = player->ball.rot_vel - dt * player->ball.rot_vel * CFG_NUM(world->config, "physics_ball_rot_scale");
        player->ball.orientation = quat_multiply(
                quat_create_from_axis_angle(player->ball.rot_vec, player->ball.rot_vel * dt),
                player->ball.orientation);
        if (player->ball.time_going_slow > 0.5f) {
            player->ball.is_moving = false;
        }
    }

    {
        // Check to see if the ball ended up in the hole
        vec3 p = vec3_add(hole_pos, CFG_VEC3(world->config, "physics_in_hole_delta"));
        vec3 capture_position=bp;
        bool captured = world->multiplayer
            ? _capture_in_cup(world,nearest_hole,bp0,bp,br,&capture_position)
            : (nearest_hole && vec3_distance(p, bp) < CFG_NUM(world->config, "physics_in_hole_radius"));
        if (captured) {
            player->ball.pos = capture_position;
            player->ball.is_in_hole = true;
            player->ball.is_moving = false;
            player->ball.vel = V3(0, 0, 0);
            player->ball.rot_vel = 0;
            player->ball.is_in_water = false;
            player->ball.is_out_of_bounds = false;
            player->ball.time_out_of_bounds = -1;
            return;
        }

        // Check to see if the ball ended up out of bounds
        for (int i = 0; i < num_contacts; i++) {
            golf_ball_contact_t *contact = &contacts[i];
            if (!water_support&&!contact->is_ignored&&contact->is_out_of_bounds) {
                player->ball.time_out_of_bounds = world->time;
                player->ball.is_out_of_bounds = true;
            }
        }
    }

    if (player->ball.is_in_water) {
        player->ball.time_out_of_water = 0;
        player->ball.time_since_water_ripple += dt;
        if (player->ball.time_since_water_ripple > CFG_NUM(world->config, "water_ripple_frequency")) {
            player->ball.time_since_water_ripple = 0;
            
            vec3 pos = player->ball.draw_pos;
            pos.y -= player->ball.radius;
            pos.y += 0.02f;

            if (world->ripple) world->ripple(pos);
        }
    }
    else {
        player->ball.time_out_of_water += dt;
    }

    if (player->ball.pos.y < CFG_NUM(world->config, "physics_kill_y")) {
        player->ball.time_out_of_bounds = world->time;
        player->ball.is_out_of_bounds = true;
    }

    if (player->ball.time_out_of_water < 0.1f) {
        if (world->sound) world->sound("ball_in_water", "data/audio/in_water.ogg", 0.1f, true, false);
    }
    else {
        if (world->stop_sound) world->stop_sound("ball_in_water", 0.2f);
    }
    /* Sleep at a static fixed point, away from the cup. Moving geometry,
       shots, wind, pets, water and position changes all invalidate this cache. */
    if(!full_rest&&!started_moving&&!ball->is_moving&&!ball->is_in_water&&!ball->is_out_of_bounds&&
       ball->pos.x==bp0.x&&ball->pos.y==bp0.y&&ball->pos.z==bp0.z&&
       ball->vel.x==bv0.x&&ball->vel.y==bv0.y&&ball->vel.z==bv0.z&&
       dist_to_hole>fmaxf(CFG_NUM(world->config,"physics_hole_force_distance"),world->funnel_radius)+.3f&&
       !moving_contact(world,ball)){
        // A tee can be exactly tangent to its floor and have no strict-radius
        // contact. Probe a 2 mm margin without changing position or velocity.
        int support_count=0;
        golf_bvh_ball_test(world->static_bvh,ball->pos,ball->radius+.002f,ball->vel,contacts,&support_count,MAX_NUM_CONTACTS);
        for(int i=0;i<support_count;i++){
            golf_ball_contact_t *c=&contacts[i];
            if(!c->is_ignored&&!c->is_water&&!c->is_out_of_bounds&&c->type==TRIANGLE_CONTACT_FACE&&c->normal.y>.5f){
                ball->resting_static=true;ball->resting_pos=ball->pos;ball->resting_vel=ball->vel;ball->resting_dt=dt;break;
            }
        }
    }
}

bool golf_physics_shoot(golf_physics_world_t *world, golf_player_t *player, vec3 direction, float power) {
    if (!player || !player->connected || player->ball.is_moving || player->ball.is_in_hole || player->ball.capture_until>0 ||
            !isfinite(power) || power < 0 || power > 1 ||
            !isfinite(direction.x) || !isfinite(direction.y) || !isfinite(direction.z)) return false;
    direction.y = 0;
    float len = vec3_length(direction);
    if (!isfinite(len) || len < 0.001f) return false;
    float gp = CFG_NUM(world->config, "aim_green_power"), yp = CFG_NUM(world->config, "aim_yellow_power"), rp = CFG_NUM(world->config, "aim_red_power");
    float gs = CFG_NUM(world->config, "aim_green_speed"), ys = CFG_NUM(world->config, "aim_yellow_speed"), rs = CFG_NUM(world->config, "aim_red_speed"), ds = CFG_NUM(world->config, "aim_dark_red_speed");
    float speed = power < gp ? gs + (ys-gs)*power/gp : power < yp ? ys + (rs-ys)*(power-gp)/(yp-gp) : power < rp ? rs + (ds-rs)*(power-yp)/(rp-yp) : ds;
    player->ball.vel = vec3_scale(direction, speed / len);
    if(player->ball.slow_shots>0)player->ball.vel=vec3_scale(player->ball.vel,.65f);
    player->ball.start_pos = player->ball.pos;
    player->ball.is_moving = true;
    player->ball.time_going_slow = 0;
    player->stroke_count++;
    return true;
}
