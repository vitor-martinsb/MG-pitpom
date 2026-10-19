#include "golf/mechanics.h"
#include "golf/navigation.h"
#include <float.h>
#include <math.h>
#include <string.h>
static golf_navigation_t navigation;
static golf_bvh_aabb_t moving_zones[32];static int moving_zone_count;
static bool dynamic_clear(vec3 p,float radius){
    for(int i=0;i<moving_zone_count;i++){
        golf_bvh_aabb_t a=moving_zones[i];
        if(p.y+.85f>=a.min.y&&p.y<=a.max.y&&p.x+radius>=a.min.x&&p.x-radius<=a.max.x&&p.z+radius>=a.min.z&&p.z-radius<=a.max.z)return false;
    }
    return true;
}
static void moving_bounds(golf_level_t *level){
    moving_zone_count=0;golf_bvh_t temporary;golf_bvh_init(&temporary);
    for(int i=0;i<level->entities.length&&moving_zone_count<32;i++){
        golf_entity_t *e=&level->entities.data[i];golf_movement_t *move=golf_entity_get_movement(e);
        if(!move||move->type==GOLF_MOVEMENT_NONE||(e->type==MODEL_ENTITY&&e->model.ignore_physics))continue;
        golf_bvh_aabb_t area={V3(FLT_MAX,FLT_MAX,FLT_MAX),V3(-FLT_MAX,-FLT_MAX,-FLT_MAX)};
        for(int k=0;k<16;k++){
            temporary.faces.length=0;golf_bvh_node_info_t info=golf_bvh_node_info(&temporary,i,level,e,move->t0+fmaxf(move->length,1)*k/15.f);
            area.min=V3(fminf(area.min.x,info.aabb.min.x),fminf(area.min.y,info.aabb.min.y),fminf(area.min.z,info.aabb.min.z));
            area.max=V3(fmaxf(area.max.x,info.aabb.max.x),fmaxf(area.max.y,info.aabb.max.y),fmaxf(area.max.z,info.aabb.max.z));
        }
        moving_zones[moving_zone_count++]=area;
    }
    vec_deinit(&temporary.faces);vec_deinit(&temporary.nodes);vec_deinit(&temporary.node_infos);
}
const golf_navigation_t *golf_mechanics_navigation(void){return &navigation;}

static vec3 placement(golf_mechanics_t *m,golf_navigation_t *nav,golf_bvh_t *bvh,float progress,bool *valid) {
    vec3 wanted=vec3_add(m->start,vec3_scale(vec3_sub(m->hole,m->start),progress));
    vec3 best=m->start;float score=FLT_MAX;*valid=false;
    for(int i=0;i<nav->count;i++) {
            if(!nav->nodes[i].reachable)continue;vec3 p=nav->nodes[i].pos;
            if(vec3_distance(p,m->start)<1.5f||vec3_distance(p,m->hole)<1.5f)continue;
            if(progress>.5f&&vec3_distance(p,m->cat_center)<1.7f)continue;
            float d=vec3_distance(p,wanted);if(d>=score)continue;
            vec3 hit;if(!dynamic_clear(p,.72f)||!golf_nav_floor(bvh,p,&hit,.72f)||fabsf(hit.y-p.y)>.1f)continue;
            if(progress<.5f){
                vec3 forward=vec3_sub(golf_nav_target(nav,p),p);forward.y=0;
                if(vec3_length(forward)<.1f)forward=m->direction;else forward=vec3_normalize(forward);
                vec3 side=vec3_cross(forward,V3(0,1,0));vec3 a=vec3_add(p,vec3_scale(side,.1f)),b=vec3_sub(p,vec3_scale(side,.1f));
                if(!dynamic_clear(a,.72f)||!dynamic_clear(b,.72f)||!golf_nav_floor(bvh,a,&hit,.72f)||!golf_nav_floor(bvh,b,&hit,.72f)||!golf_nav_segment(bvh,a,b,.72f))continue;
            }
            score=d;best=p;*valid=true;
    }
    if(!*valid)fprintf(stderr,"Mascot placement: no reachable region with safe clearance; obstacle disabled.\n");
    return best;
}
void golf_mechanics_init(golf_mechanics_t *m,golf_level_t *level,golf_bvh_t *bvh) {
    memset(m,0,sizeof(*m));m->forward_probability=.5f;m->slap_speed=7.5f;m->reach=.62f;m->cooldown=2.8f;
    m->seed=0x50495450u;m->cat_slap_time=m->dog_wake_time=-100;
    m->bounds_min=V3(FLT_MAX,FLT_MAX,FLT_MAX);m->bounds_max=V3(-FLT_MAX,-FLT_MAX,-FLT_MAX);
    for(int i=0;i<level->entities.length;i++) {
        golf_entity_t *e=&level->entities.data[i];
        if(e->type==BALL_START_ENTITY)m->start=golf_entity_get_world_transform(level,e).position;
        if(e->type==HOLE_ENTITY)m->hole=golf_entity_get_world_transform(level,e).position;
    }
    for(int i=0;i<bvh->faces.length;i++) {
        golf_bvh_face_t *f=&bvh->faces.data[i];
        if(!f->entity||f->entity->type!=GEO_ENTITY)continue;
        vec3 vertices[]={f->a,f->b,f->c};
        for(int j=0;j<3;j++){vec3 p=vertices[j];m->bounds_min=V3(fminf(m->bounds_min.x,p.x),fminf(m->bounds_min.y,p.y),fminf(m->bounds_min.z,p.z));m->bounds_max=V3(fmaxf(m->bounds_max.x,p.x),fmaxf(m->bounds_max.y,p.y),fmaxf(m->bounds_max.z,p.z));}
    }
    if(m->bounds_min.x==FLT_MAX){m->bounds_min=vec3_sub(m->start,V3(2,0,2));m->bounds_max=vec3_add(m->hole,V3(2,1,2));}
    m->direction=vec3_sub(m->hole,m->start);m->direction.y=0;
    m->direction=vec3_length(m->direction)>.01f?vec3_normalize(m->direction):V3(0,0,-1);
    m->across=vec3_cross(m->direction,V3(0,1,0));
    moving_bounds(level);
    golf_nav_build(&navigation,bvh,m->start,m->hole);
    m->cat_center=placement(m,&navigation,bvh,.36f,&m->cat_valid);m->cat=m->cat_center;m->dog=placement(m,&navigation,bvh,.68f,&m->dog_valid);
    vec3 local=vec3_sub(golf_nav_target(&navigation,m->cat_center),m->cat_center);local.y=0;
    if(vec3_length(local)>.1f)m->direction=vec3_normalize(local);
    m->across=vec3_cross(m->direction,V3(0,1,0));
    m->cat_span=0;
    for(float span=.05f;span<=1.2f;span+=.05f) {
        vec3 a,b;
        if(!dynamic_clear(vec3_add(m->cat_center,vec3_scale(m->across,span)),.72f)||!dynamic_clear(vec3_sub(m->cat_center,vec3_scale(m->across,span)),.72f)||
            !golf_nav_segment(bvh,m->cat_center,vec3_add(m->cat_center,vec3_scale(m->across,span)),.72f)||
            !golf_nav_segment(bvh,m->cat_center,vec3_sub(m->cat_center,vec3_scale(m->across,span)),.72f)||
            !golf_nav_floor(bvh,vec3_add(m->cat_center,vec3_scale(m->across,span)),&a,.72f)||
            !golf_nav_floor(bvh,vec3_sub(m->cat_center,vec3_scale(m->across,span)),&b,.72f)||
           fabsf(a.y-m->cat_center.y)>.12f||fabsf(b.y-m->cat_center.y)>.12f)break;
        m->cat_span=span;
    }
    golf_wildlife_init(&m->wildlife,level,bvh,&navigation,m->start,m->hole,m->cat,m->dog,moving_zones,moving_zone_count);
}
void golf_mechanics_animate(golf_mechanics_t *m,float time) {
    /* Sine easing has a brief, gentle pause at each end of the crossing. */
    float phase=sinf(time*.75f);
    m->cat=vec3_add(m->cat_center,vec3_scale(m->across,m->cat_span*phase));
}
void golf_ball_return_before_shot(golf_player_t *p) {
    golf_ball_t *b=&p->ball;
    b->pos=b->draw_pos=b->start_pos;b->vel=b->rot_vec=V3(0,0,0);b->rot_vel=0;
    b->orientation=QUAT(0,0,0,1);b->is_moving=b->is_in_water=b->is_out_of_bounds=b->captured=false;
    b->capture_until=0;b->time_going_slow=0;b->time_out_of_bounds=-1;b->time_out_of_water=1;
}
static uint32_t random_word(uint32_t n) {
    n^=n>>16;n*=0x7feb352du;n^=n>>15;n*=0x846ca68bu;return n^(n>>16);
}
void golf_mechanics_tick(golf_mechanics_t *m,golf_player_t *players,int count,float time) {
    golf_mechanics_animate(m,time);
    for(int i=0;i<count;i++) {
        golf_player_t *p=&players[i];golf_ball_t *b=&p->ball;
        if(!p->id||!p->connected)continue;
        if(b->capture_until>0) {
            if(!b->capture_kind) {
                if(time>=b->capture_until) {golf_ball_return_before_shot(p);b->dog_cooldown=time+3;}
                else {b->captured=time>=b->capture_until-.75f;b->is_moving=true;b->vel=V3(0,0,0);}
            }
        } else if(m->enabled&&!b->is_in_hole&&p->stroke_count>0) {
            float cat_distance=vec3_distance(b->pos,vec3_add(m->cat,V3(0,b->radius,0)));
            if(cat_distance>m->reach+.18f)b->cat_contact=false;
            if(m->cat_valid&&cat_distance<m->reach&&!b->cat_contact&&time>=b->cat_cooldown) {
                b->cat_contact=true;b->cat_cooldown=time+m->cooldown;b->cat_hits++;
                float random=(random_word(m->seed^p->id^(b->cat_hits*0x9e3779b9u))>>8)/16777216.f;
                b->vel=vec3_scale(m->direction,random<m->forward_probability?m->slap_speed:-m->slap_speed);
                b->is_moving=true;b->time_going_slow=0;m->cat_slap_time=time;
            }
            if(m->dog_valid&&vec3_distance(b->pos,vec3_add(m->dog,V3(0,b->radius,0)))<m->reach&&
               time>=b->dog_cooldown&&b->dog_stroke!=p->stroke_count) {
                b->dog_stroke=p->stroke_count;b->capture_until=time+1.1f;b->captured=false;
                b->is_moving=true;b->vel=V3(0,0,0);m->dog_wake_time=time;
            }
        }
        if(p->stroke_count>0&&!b->is_moving&&!b->capture_until&&!b->first_shot_complete){b->first_shot_complete=true;b->collision_grace=.25f;}
        b->collision_grace=fmaxf(0,b->collision_grace-1.f/120);
    }
    golf_wildlife_tick(&m->wildlife,players,count,time,m->seed,m->enabled);
    if(m->impact)golf_mechanics_impacts(players,count);
}
static bool eligible(golf_player_t *p) {
    return p->id&&p->connected&&p->ball.first_shot_complete&&!p->ball.is_in_hole&&
        !p->ball.capture_until&&!p->ball.is_out_of_bounds&&!p->ball.is_in_water;
}
void golf_mechanics_impacts(golf_player_t *players,int count) {
    /* Equal unit masses, restitution .72, fixed slot order. 4 passes separate
       crowded groups without sending any impact back as a player stroke. */
    for(int pass=0;pass<4;pass++)for(int i=0;i<count;i++)for(int j=i+1;j<count;j++) {
        golf_player_t *a=&players[i],*b=&players[j];if(!eligible(a)||!eligible(b))continue;
        vec3 delta=vec3_sub(b->ball.pos,a->ball.pos);float d=vec3_length(delta),r=a->ball.radius+b->ball.radius;
        if(d>=r)continue;
        float angle=(a->id*13u+b->id*7u)*.618f;
        vec3 n=d>.0001f?vec3_scale(delta,1/d):V3(cosf(angle),0,sinf(angle));
        /* Planar correction cannot launch grounded balls vertically. */
        n.y=0;if(vec3_length(n)<.001f)continue;n=vec3_normalize(n);
        vec3 correction=vec3_scale(n,(r-d+.0001f)*.5f);
        a->ball.pos=vec3_sub(a->ball.pos,correction);b->ball.pos=vec3_add(b->ball.pos,correction);
        float relative=vec3_dot(vec3_sub(b->ball.vel,a->ball.vel),n);
        if(relative<0&&a->ball.collision_grace<=0&&b->ball.collision_grace<=0) {
            vec3 impulse=vec3_scale(n,-(1+.72f)*relative*.5f);
            a->ball.vel=vec3_sub(a->ball.vel,impulse);b->ball.vel=vec3_add(b->ball.vel,impulse);
            golf_ball_t *balls[]={&a->ball,&b->ball};
            for(int k=0;k<2;k++){float speed=vec3_length(balls[k]->vel);if(speed>12)balls[k]->vel=vec3_scale(balls[k]->vel,12/speed);balls[k]->is_moving=true;balls[k]->time_going_slow=0;}
        }
    }
}
