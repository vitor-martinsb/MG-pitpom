#include "golf/mechanics.h"
#include <float.h>
#include <math.h>
#include <string.h>

static bool playable(const golf_bvh_face_t *f) {
    if(!f->entity || f->entity->type!=GEO_ENTITY || f->entity->geo.geo.is_water) return false;
    vec3 n=vec3_normalize(vec3_cross(vec3_sub(f->b,f->a),vec3_sub(f->c,f->a)));
    return n.y>.75f && f->vel_scale>.1f;
}
static bool floor_at(golf_bvh_t *bvh, vec3 p, vec3 *floor) {
    float t=FLT_MAX;int idx=-1;golf_bvh_face_t face;
    vec3 origin=vec3_add(p,V3(0,2,0));
    if(!golf_bvh_ray_test(bvh,origin,V3(0,-1,0),&t,&idx,&face)||!playable(&face)||t>2.3f) return false;
    *floor=vec3_add(origin,V3(0,-t,0));return true;
}
static vec3 placement(golf_mechanics_t *m,golf_bvh_t *bvh,float progress) {
    vec3 wanted=vec3_add(m->start,vec3_scale(vec3_sub(m->hole,m->start),progress));
    vec3 best=wanted;float score=FLT_MAX;
    /* Barycentric samples support corners and tracks with several elevations. */
    for(int i=0;i<bvh->faces.length;i++) {
        golf_bvh_face_t *f=&bvh->faces.data[i];if(!playable(f))continue;
        for(int a=1;a<=4;a++)for(int b=1;b<=5-a;b++) {
            float u=a/6.f,v=b/6.f;
            vec3 p=vec3_add(f->a,vec3_add(vec3_scale(vec3_sub(f->b,f->a),u),vec3_scale(vec3_sub(f->c,f->a),v)));
            if(vec3_distance(p,m->start)<1.5f||vec3_distance(p,m->hole)<1.5f)continue;
            if(progress>.5f&&vec3_distance(p,m->cat_center)<1.7f)continue;
            vec3 hit;if(!floor_at(bvh,p,&hit)||fabsf(hit.y-p.y)>.1f)continue;
            float d=vec3_distance(p,wanted);if(d<score){score=d;best=p;}
        }
    }
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
    m->cat_center=placement(m,bvh,.36f);m->cat=m->cat_center;m->dog=placement(m,bvh,.68f);
    m->cat_span=.1f;
    for(float span=.15f;span<=1.2f;span+=.05f) {
        vec3 a,b;
        if(!floor_at(bvh,vec3_add(m->cat_center,vec3_scale(m->across,span+.18f)),&a)||
           !floor_at(bvh,vec3_sub(m->cat_center,vec3_scale(m->across,span+.18f)),&b)||
           fabsf(a.y-m->cat_center.y)>.12f||fabsf(b.y-m->cat_center.y)>.12f)break;
        m->cat_span=span;
    }
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
            if(time>=b->capture_until) {golf_ball_return_before_shot(p);b->dog_cooldown=time+3;}
            else {b->captured=time>=b->capture_until-.75f;b->is_moving=true;b->vel=V3(0,0,0);}
        } else if(m->enabled&&!b->is_in_hole&&p->stroke_count>0) {
            float cat_distance=vec3_distance(b->pos,vec3_add(m->cat,V3(0,b->radius,0)));
            if(cat_distance>m->reach+.18f)b->cat_contact=false;
            if(cat_distance<m->reach&&!b->cat_contact&&time>=b->cat_cooldown) {
                b->cat_contact=true;b->cat_cooldown=time+m->cooldown;b->cat_hits++;
                float random=(random_word(m->seed^p->id^(b->cat_hits*0x9e3779b9u))>>8)/16777216.f;
                b->vel=vec3_scale(m->direction,random<m->forward_probability?m->slap_speed:-m->slap_speed);
                b->is_moving=true;b->time_going_slow=0;m->cat_slap_time=time;
            }
            if(vec3_distance(b->pos,vec3_add(m->dog,V3(0,b->radius,0)))<m->reach&&
               time>=b->dog_cooldown&&b->dog_stroke!=p->stroke_count) {
                b->dog_stroke=p->stroke_count;b->capture_until=time+1.1f;b->captured=false;
                b->is_moving=true;b->vel=V3(0,0,0);m->dog_wake_time=time;
            }
        }
        if(p->stroke_count>0&&!b->is_moving&&!b->capture_until)b->first_shot_complete=true;
    }
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
        if(relative<0) {
            vec3 impulse=vec3_scale(n,-(1+.72f)*relative*.5f);
            a->ball.vel=vec3_sub(a->ball.vel,impulse);b->ball.vel=vec3_add(b->ball.vel,impulse);
            golf_ball_t *balls[]={&a->ball,&b->ball};
            for(int k=0;k<2;k++){float speed=vec3_length(balls[k]->vel);if(speed>12)balls[k]->vel=vec3_scale(balls[k]->vel,12/speed);balls[k]->is_moving=true;balls[k]->time_going_slow=0;}
        }
    }
}
