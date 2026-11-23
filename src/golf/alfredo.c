#include "golf/alfredo.h"
#include "golf/wildlife.h"
#include "golf/physics.h"
#include <float.h>
static uint32_t word(uint32_t n){n^=n>>16;n*=0x7feb352du;n^=n>>15;n*=0x846ca68bu;return n^(n>>16);}
static bool safe(const golf_wildlife_t *w,vec3 p){return golf_wildlife_safe(w,p,.32f)&&vec3_distance(p,w->hole)>1.2f&&vec3_distance(p,w->spawn)>1.5f;}
static bool path(const golf_wildlife_t *w,vec3 a,vec3 b){
    if(!golf_nav_segment(w->floor,a,b,.32f))return false;
    int n=1+(int)(vec3_distance(a,b)/.08f);
    for(int i=0;i<=n;i++){vec3 p=vec3_add(a,vec3_scale(vec3_sub(b,a),i/(float)n)),floor;if(!golf_nav_floor(w->floor,p,&floor,0)||!safe(w,floor))return false;}
    return true;
}
static bool clear_air(const golf_wildlife_t *w,vec3 p){
    for(int i=0;i<7;i++){
        golf_ball_contact_t contacts[8];int count=0;
        golf_bvh_ball_test(w->floor,vec3_add(p,V3(0,.60f+i*.15f,0)),GOLF_BALL_RADIUS,V3(0,0,0),contacts,&count,8);
        if(count)return false;
    }
    return true;
}
void golf_alfredo_init(golf_wildlife_t *w,vec3 cat,vec3 dog){
    golf_companion_t *a=&w->companions.alfredo;*a=(golf_companion_t){0};
    if(!w->nav||!w->floor)return;
    vec3 wanted=vec3_add(w->spawn,vec3_scale(vec3_sub(w->hole,w->spawn),.52f));float best=FLT_MAX;
    for(int i=0;i<w->nav->count;i++){
        vec3 p=w->nav->nodes[i].pos;float score=vec3_distance(p,wanted);
        if(!w->nav->nodes[i].reachable||score>=best||!safe(w,p)||vec3_distance(p,cat)<1.3f||vec3_distance(p,dog)<1.3f)continue;
        bool apart=true;
        golf_companion_t *others[]={&w->companions.benedita,&w->companions.smanata};
        for(int k=0;k<2;k++)if(others[k]->active&&vec3_distance(p,others[k]->pos)<1.4f)apart=false;
        for(int k=0;k<GOLF_WILDLIFE_COUNT;k++)if(w->animals[k].active&&vec3_distance(p,w->animals[k].a)<1.3f)apart=false;
        // Reserve a flat, clear paw area: vertical rebounds must not meet a wall.
        for(int k=0;k<4;k++){vec3 q=vec3_add(p,V3(k==0?.45f:k==1?-.45f:0,0,k==2?.45f:k==3?-.45f:0)),floor;
            if(!golf_nav_floor(w->floor,q,&floor,0)||fabsf(floor.y-p.y)>.08f||!path(w,p,floor))apart=false;}
        if(apart&&clear_air(w,p)){best=score;a->active=true;a->pos=a->draw_pos=a->home=p;}
    }
    a->forward=vec3_sub(w->spawn,a->pos);a->forward.y=0;a->forward=vec3_length(a->forward)>.01f?vec3_normalize(a->forward):V3(0,0,1);a->look=a->forward;
}
static bool move(golf_wildlife_t *w,golf_companion_t *a,vec3 target,float dt){
    vec3 d=vec3_sub(target,a->pos);float distance=vec3_length(d),step=fminf(distance,2.5f*dt);
    if(distance<.02f){a->pos=target;a->speed=0;return true;}
    vec3 next=vec3_add(a->pos,vec3_scale(d,step/distance)),floor;
    if(!golf_nav_floor(w->floor,next,&floor,0)||!path(w,a->pos,floor)){a->speed=0;return false;}
    a->pos=floor;d.y=0;if(vec3_length(d)>.01f)a->forward=vec3_normalize(d);a->speed=dt>0?step/dt:0;a->stride+=step*9;return distance<=step+.02f;
}
static void release(golf_player_t *p,float time){
    golf_ball_t *b=&p->ball;b->capture_kind=0;b->capture_until=0;b->captured=false;b->resting_static=false;b->time_going_slow=0;b->is_moving=true;
    b->wildlife_protection=time+1.5f;b->cat_cooldown=b->dog_cooldown=time+1.5f;b->collision_grace=.3f;
}
static void beat(golf_companion_t *a,golf_ball_t *b,float time){
    a->cycles++;a->until=time;b->pos=vec3_add(a->pos,V3(0,.48f+b->radius,0));b->vel=V3(0,3.5f,0);b->captured=false;b->resting_static=false;b->time_going_slow=0;b->is_moving=true;
    b->effect_kind=GOLF_EFFECT_ALFREDO;b->effect_time=time;b->effect_serial++;
}
static bool reachable_landing(const golf_wildlife_t *w,vec3 floor){
    // A solid patch alone is not enough: it must connect to the course graph.
    for(int i=0;i<w->nav->count;i++)if(w->nav->nodes[i].reachable&&
       vec3_distance(w->nav->nodes[i].pos,floor)<.65f&&
       golf_nav_segment(w->floor,w->nav->nodes[i].pos,floor,GOLF_BALL_RADIUS))return true;
    return false;
}
static vec3 launch(const golf_wildlife_t *w,const golf_companion_t *a,const golf_ball_t *b,uint32_t seed){
    // Choose a random horizontal heading, then a reachable landing on this field.
    // Only the existing physics engine integrates the actual flight/collisions.
    float angle=(word(seed)&0xffffff)*(2*MF_PI/16777216.f),up=3.8f;
    float flight=(up+sqrtf(up*up+2*GOLF_PHYSICS_GRAVITY*(b->pos.y-a->pos.y)))/GOLF_PHYSICS_GRAVITY;
    for(int turn=0;turn<32;turn++){
        vec3 direction=V3(sinf(angle+turn*2.39996323f),0,cosf(angle+turn*2.39996323f));
        for(float speed=3;speed>=.15f;speed*=.65f){
            vec3 landing=vec3_add(a->pos,vec3_scale(direction,speed*flight)),floor;
            if(golf_nav_floor(w->floor,landing,&floor,b->radius)&&safe(w,floor)&&fabsf(floor.y-a->pos.y)<.15f&&reachable_landing(w,floor))
                return vec3_add(vec3_scale(direction,speed),V3(0,up,0));
        }
    }
    return V3(.05f,up,0); // A tiny safe hop on cramped fields, never an invalid teleport.
}
void golf_alfredo_tick(golf_wildlife_t *w,golf_player_t *players,int count,float time,uint32_t seed,bool enabled){
    golf_companion_t *a=&w->companions.alfredo;if(!a->active)return;
    float dt=a->clock>0?golf_clampf(time-a->clock,0,.1f):0;a->clock=time;
    golf_player_t *p=NULL;for(int i=0;i<count;i++)if(a->player&&players[i].id==a->player)p=&players[i];
    if(a->state>=ALFREDO_CAPTURE&&a->state<=ALFREDO_JUGGLE&&(!p||!p->connected||p->ball.capture_kind!=GOLF_CAPTURE_ALFREDO||p->ball.is_in_hole)){
        if(p&&p->ball.capture_kind==GOLF_CAPTURE_ALFREDO){release(p,time);p->ball.vel=V3(0,0,0);}
        a->state=ALFREDO_RECOVER;a->until=time;a->player=0;p=NULL;
    }
    if(a->state==ALFREDO_IDLE&&enabled&&time>=a->cooldown){
        float best=1.5f;for(int i=0;i<count;i++){
            golf_player_t *q=&players[i];golf_ball_t *b=&q->ball;vec3 ground=vec3_sub(b->pos,V3(0,b->radius,0));float d=vec3_distance(ground,a->pos);
            if(q->id&&q->connected&&q->stroke_count>0&&b->is_moving&&!b->is_in_hole&&!b->is_out_of_bounds&&!b->is_in_water&&!b->capture_until&&time>=b->wildlife_protection&&d<best&&fabsf(ground.y-a->pos.y)<.08f&&path(w,a->pos,ground)&&clear_air(w,ground)){
                best=d;p=q;a->player=q->id;
            }
        }
        if(p){a->state=ALFREDO_APPROACH;a->until=time+2;}
    }
    if(a->state==ALFREDO_APPROACH){
        vec3 target=p?vec3_sub(p->ball.pos,V3(0,p->ball.radius,0)):a->home;
        if(!p||!p->connected||p->ball.capture_until||p->ball.is_in_hole||time>a->until||vec3_distance(target,a->home)>1.6f||fabsf(target.y-a->home.y)>.08f||!path(w,a->home,target)||!path(w,a->pos,target)||!clear_air(w,target)){
            a->state=ALFREDO_RETURN;a->player=0;
        }else{
            move(w,a,target,dt);
            if(vec3_distance(target,a->pos)<.36f){
                a->state=ALFREDO_CAPTURE;a->until=time;a->cycles=0;a->speed=0;
                golf_ball_t *b=&p->ball;b->capture_target=b->pos;b->capture_kind=GOLF_CAPTURE_ALFREDO;b->capture_until=FLT_MAX;b->captured=true;b->is_moving=true;b->vel=b->rot_vec=V3(0,0,0);b->rot_vel=0;b->resting_static=false;
            }
        }
    }
    if(p&&(a->state==ALFREDO_CAPTURE||a->state==ALFREDO_ROLL)){
        vec3 paws=vec3_add(a->pos,V3(0,.48f+p->ball.radius,0));
        float blend=a->state==ALFREDO_CAPTURE?golf_clampf((time-a->until)/.22f,0,1):1;
        p->ball.pos=p->ball.draw_pos=vec3_add(p->ball.capture_target,vec3_scale(vec3_sub(paws,p->ball.capture_target),blend));
        if(a->state==ALFREDO_CAPTURE&&time>=a->until+.22f){a->state=ALFREDO_ROLL;a->until=time;}
        else if(a->state==ALFREDO_ROLL&&time>=a->until+.55f){a->state=ALFREDO_JUGGLE;beat(a,&p->ball,time);}
    }
    if(p&&a->state==ALFREDO_JUGGLE){
        golf_ball_t *b=&p->ball;float height=a->pos.y+.48f+b->radius;
        // Contact is detected from the REAL falling 3D ball, not an animation timer.
        if(b->vel.y<0&&b->pos.y<=height&&time>a->until+.15f){
            if(a->cycles<3)beat(a,b,time);
            else{b->pos.y=height;b->vel=launch(w,a,b,seed^(++w->companions.alfredo_launches*0x9e3779b9u)^p->id);release(p,time);a->cycles=4;a->state=ALFREDO_KICK;a->until=time;b->effect_time=time;b->effect_serial++;}
        }else if(time-a->until>3||b->is_out_of_bounds||b->is_in_water){
            // Interrupted sequences always restore normal physics/recovery.
            release(p,time);a->state=ALFREDO_RECOVER;a->until=time;a->player=0;
        }
    }
    if(a->state==ALFREDO_KICK&&time>a->until+.25f){a->state=ALFREDO_RECOVER;a->until=time;a->player=0;}
    if(a->state==ALFREDO_RECOVER&&time>a->until+.85f)a->state=ALFREDO_RETURN;
    if(a->state==ALFREDO_RETURN){if(move(w,a,a->home,dt)){a->state=ALFREDO_COOLDOWN;a->cooldown=time+5;a->speed=0;}}
    if(a->state==ALFREDO_COOLDOWN&&time>=a->cooldown)a->state=ALFREDO_IDLE;
    if(a->state==ALFREDO_IDLE||a->state==ALFREDO_COOLDOWN){
        float best=6;for(int i=0;i<count;i++)if(players[i].connected&&!players[i].ball.is_in_hole){vec3 d=vec3_sub(players[i].ball.pos,a->pos);d.y=0;float n=vec3_length(d);if(n>.01f&&n<best){best=n;a->look=vec3_scale(d,1/n);}}
    }
    if(a->state!=ALFREDO_APPROACH&&a->state!=ALFREDO_RETURN)a->speed=0;
    a->draw_pos=a->pos;
}
