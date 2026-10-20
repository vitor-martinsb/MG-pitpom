#include "golf/wildlife.h"
#include <float.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "golf/reference-courses.h"

static uint32_t random_word(uint32_t n) {
    n^=n>>16;n*=0x7feb352du;n^=n>>15;n*=0x846ca68bu;return n^(n>>16);
}
bool golf_wildlife_safe(const golf_wildlife_t *w,vec3 p,float radius) {
    vec3 floor;
    if(!w->floor||!golf_nav_floor(w->floor,p,&floor,radius)||fabsf(floor.y-p.y)>.2f)return false;
    for(int i=0;i<w->excluded_count;i++) {
        golf_bvh_aabb_t a=w->excluded[i];
        if(p.y+1>=a.min.y&&p.y<=a.max.y&&p.x+radius>=a.min.x&&p.x-radius<=a.max.x&&p.z+radius>=a.min.z&&p.z-radius<=a.max.z)return false;
    }
    return true;
}
static bool separated(const golf_wildlife_t *w,vec3 p,int until,vec3 cat,vec3 dog) {
    float reserve=until<0?1.25f:1.6f;
    if(vec3_distance(p,w->spawn)<(until<0?1.25f:2)||vec3_distance(p,w->hole)<1.5f||vec3_distance(p,cat)<reserve||vec3_distance(p,dog)<reserve)return false;
    /* These are alternative third-pet routes, never simultaneous occupants. */
    (void)until;
    for(int i=0;i<w->portal_count;i++)if(vec3_distance(p,w->portals[i].pos)<1.6f)return false;
    return true;
}
void golf_wildlife_init(golf_wildlife_t *w,golf_level_t *level,golf_bvh_t *floor,const golf_navigation_t *nav,
        vec3 start,vec3 hole,vec3 cat,vec3 dog,const golf_bvh_aabb_t *excluded,int excluded_count) {
    memset(w,0,sizeof(*w));w->floor=floor;w->nav=nav;w->spawn=start;w->hole=hole;w->time=-1;
    w->excluded_count=excluded_count<32?excluded_count:32;
    memcpy(w->excluded,excluded,w->excluded_count*sizeof(*excluded));
    vec3 wanted[3];bool present[3]={false};
    for(int i=0;i<level->entities.length;i++) {
        golf_entity_t *e=&level->entities.data[i];if(e->type!=GROUP_ENTITY)continue;
        golf_transform_t t=golf_entity_get_world_transform(level,e);int kind,pair,end;float strength;
        if(sscanf(e->name,"campaign:%d:%d:%d",&w->world,&w->stage,&w->course)==3)continue;
        if(sscanf(e->name,"animal:%d",&kind)==1&&kind>=0&&kind<3){wanted[kind]=t.position;present[kind]=true;}
        else if(sscanf(e->name,"wind:%f",&strength)==1&&w->wind_count<GOLF_WIND_ZONES)
            w->wind[w->wind_count++]=(golf_wind_zone_t){t.position,t.scale,strength};
        else if(sscanf(e->name,"portal:%d:%d",&pair,&end)==2&&w->portal_count<GOLF_PORTALS)
            w->portals[w->portal_count++]=(golf_portal_t){t.position,pair,end,false};
    }
    /* Recognize the preserved maps without adding markers to their geometry. */
    if(!w->course)for(int index=0;index<20;index++) {
        if(level->entities.length!=reference_courses[index].entities)continue;
        bool match=false;
        for(int i=0;i<level->entities.length;i++) {
            golf_entity_t *e=&level->entities.data[i];
            if(e->type==HOLE_ENTITY&&vec3_distance(golf_entity_get_world_transform(level,e).position,reference_courses[index].hole)<.001f)match=true;
        }
        if(!match)continue;
        w->course=index*4+1;w->world=index/2+1;w->stage=index%2*4+1;
        for(int kind=0;kind<3;kind++)if(!present[kind]) {
            wanted[kind]=vec3_add(start,vec3_scale(vec3_sub(hole,start),.25f+kind*.25f));present[kind]=true;
        }
        break;
    }
    for(int i=0;i<w->portal_count;i++){
        golf_portal_t *portal=&w->portals[i];portal->active=golf_wildlife_safe(w,portal->pos,.26f);
        if(!portal->active){
            float best=3.0f;vec3 wanted=portal->pos;
            for(int j=0;j<nav->count;j++){
                vec3 p=nav->nodes[j].pos;float d=vec3_distance(wanted,p);
                if(d<best&&vec3_distance(p,start)>1.3f&&vec3_distance(p,hole)>1.3f&&golf_wildlife_safe(w,p,.26f)){best=d;portal->pos=p;portal->active=true;}
            }
        }
    }
    for(int kind=0;kind<3;kind++)if(present[kind]) {
        float score=FLT_MAX;int best=-1;bool shared=false;
        /* On narrow fields use a second spatial search, preserving separation
           from both permanent mascots and clearance from the tee and cup. */
        for(int pass=0;pass<2&&best<0;pass++)for(int j=0;j<nav->count;j++) {
            vec3 p=nav->nodes[j].pos;float d=vec3_distance(p,wanted[kind]);
            if(!nav->nodes[j].reachable||d>=score||!separated(w,p,pass?-1:kind,cat,dog)||!golf_wildlife_safe(w,p,.48f)||((w->course-1)%4&&!golf_wildlife_safe(w,p,.44f)))continue;
            score=d;best=j;shared=pass!=0;
        }
        if(best<0)continue;
        golf_wild_animal_t *a=&w->animals[kind];a->active=a->present=true;a->a=a->b=a->pos=nav->nodes[best].pos;
        a->forward=V3(0,0,-1);a->action_time=-100;a->clock=0;
        a->presence=1;a->patrol_period=8+kind*1.7f;
        // A short, fully sampled corridor avoids walls, water and moving sweeps.
        for(int j=0;j<nav->count;j++) {
            vec3 p=nav->nodes[j].pos;float d=vec3_distance(a->a,p);
            if(!nav->nodes[j].reachable||d<.7f||d>1.8f||!separated(w,p,shared?-1:kind,cat,dog)||!golf_wildlife_safe(w,p,.48f)||!golf_nav_segment(floor,a->a,p,.48f))continue;
            int samples=(w->course-1)%4?(int)ceilf(d/.04f):8;
            bool safe=true;for(int k=0;k<=samples;k++){
                vec3 q=vec3_add(a->a,vec3_scale(vec3_sub(p,a->a),k/(float)samples));
                if(!golf_wildlife_safe(w,q,.48f)||((w->course-1)%4&&!golf_wildlife_safe(w,q,.44f)))safe=false;
            }
            if(safe){a->b=p;break;}
        }
    }
}
static void animate(golf_wildlife_t *w,float time) {
    float dt=w->time<0?0:golf_clampf(time-w->time,0,.1f);w->time=time;
    for(int kind=0;kind<3;kind++) {
        golf_wild_animal_t *a=&w->animals[kind];if(!a->active)continue;
        float age=time-a->action_time;
        if(age>=0&&age<1.1f){a->walking=false;a->speed=0;a->gait*=expf(-dt*12);continue;}
        a->clock+=dt;float period=a->patrol_period>0?a->patrol_period:8+kind*1.7f,p=fmodf(a->clock,period)/period;
        float t=p<.4f?p/.4f:p<.5f?1:p<.9f?1-(p-.5f)/.4f:0;
        t=t*t*(3-2*t);vec3 old=a->pos;
        a->pos=vec3_add(a->a,vec3_scale(vec3_sub(a->b,a->a),t));
        vec3 hit;if(golf_nav_floor(w->floor,a->pos,&hit,0))a->pos.y=hit.y;
        vec3 velocity=vec3_sub(a->pos,old);velocity.y=0;a->walking=vec3_length(velocity)>.00001f;
        float travelled=vec3_length(velocity);a->speed=dt>0?travelled/dt:0;
        a->stride+=travelled*(2*MF_PI/.42f);a->gait+=(golf_clampf(a->speed/.18f,0,1)-a->gait)*(1-expf(-dt*14));
        if(a->walking)a->forward=vec3_normalize(velocity);
    }
}
void golf_wildlife_shot(golf_wildlife_t *w,const golf_player_t *p){
    if(!p->id||p->stroke_count<1)return;
    for(int i=0;i<GOLF_MAX_PLAYERS;i++)if(w->shots[i].player==p->id||!w->shots[i].player){
        golf_wild_shot_t *s=&w->shots[i];if(s->player==p->id&&s->stroke>=p->stroke_count)return;
        *s=(golf_wild_shot_t){p->id,++w->accepted_shots,p->stroke_count,true};return;
    }
}
static void finish_shots(golf_wildlife_t *w,golf_player_t *players,int count){
    for(int i=0;i<count;i++){
        golf_player_t *p=&players[i];if(!p->id)continue;
        for(int j=0;j<GOLF_MAX_PLAYERS;j++){
            golf_wild_shot_t *s=&w->shots[j];
            if(s->player!=p->id||!s->pending||(!p->ball.is_in_hole&&(p->ball.is_moving||p->ball.capture_until)))continue;
            s->pending=false;
            if(p->ball.slow_shots>0&&s->stroke>p->ball.slow_born_stroke){
                if(--p->ball.slow_shots==0)p->ball.slow_until=0;
            }
            for(int k=0;k<GOLF_PUDDLES;k++){
                golf_puddle_t *q=&w->puddles[k];
                if(q->active&&s->sequence>q->born&&s->sequence<=q->born+3&&--q->remaining==0)q->active=false;
            }
        }
    }
}
static void puddle(golf_wildlife_t *w,vec3 pos){
    for(int i=0;i<GOLF_PUDDLES;i++)if(!w->puddles[i].active){
        w->puddles[i]=(golf_puddle_t){pos,++w->next_puddle,w->accepted_shots,3,true};return;
    }
}
static vec3 random_destination(const golf_wildlife_t *w,const golf_player_t *p,uint32_t seed) {
    uint32_t first=random_word(seed^p->id^(p->ball.wildlife_hits[2]*0x9e3779b9u));
    for(int k=0;k<w->nav->count;k++) {
        int j=(first+(uint32_t)k)%w->nav->count;vec3 q=w->nav->nodes[j].pos;
        if(!w->nav->nodes[j].reachable||vec3_distance(q,w->hole)<1.3f||vec3_distance(q,p->ball.pos)<2||!golf_wildlife_safe(w,q,.28f))continue;
        bool clear=true;
        for(int a=0;a<3;a++)if(w->animals[a].active&&fminf(vec3_distance(q,w->animals[a].a),vec3_distance(q,w->animals[a].b))<1.5f)clear=false;
        for(int a=0;a<w->portal_count;a++)if(vec3_distance(q,w->portals[a].pos)<1.3f)clear=false;
        if(clear)return vec3_add(q,V3(0,p->ball.radius,0));
    }
    return vec3_add(w->spawn,V3(0,p->ball.radius,0));
}
static void capture(golf_ball_t *b,int kind,vec3 target,float time,float duration) {
    b->capture_kind=kind;b->capture_target=target;b->capture_until=time+duration;
    b->captured=true;b->is_moving=true;b->vel=V3(0,0,0);
    b->effect_kind=kind;b->effect_time=time;b->effect_serial++;
}
static void release(golf_ball_t *b,float time) {
    b->pos=b->draw_pos=b->start_pos=b->capture_target;
    b->vel=b->rot_vec=V3(0,0,0);b->orientation=QUAT(0,0,0,1);b->rot_vel=0;
    b->capture_until=0;b->capture_kind=0;b->captured=false;b->is_moving=false;
    b->is_in_water=b->is_out_of_bounds=false;b->time_going_slow=0;
    b->time_out_of_bounds=-1;b->time_out_of_water=1;
    b->wildlife_protection=time+2.5f;b->cat_cooldown=b->dog_cooldown=time+2.5f;
    b->collision_grace=.3f;
}
void golf_wildlife_tick(golf_wildlife_t *w,golf_player_t *players,int count,float time,uint32_t seed,bool enabled) {
    animate(w,time);
    for(int i=0;i<count;i++) {
        golf_player_t *p=&players[i];golf_ball_t *b=&p->ball;
        if(!p->id||!p->connected||b->is_in_hole)continue;
        if(b->capture_kind) {
            if(time>=b->capture_until)release(b,time);
            continue;
        }
        bool wet=false,slow_applied=false;
        if(enabled)for(int j=0;j<GOLF_PUDDLES;j++)if(w->puddles[j].active&&vec3_distance(b->pos,vec3_add(w->puddles[j].pos,V3(0,b->radius,0)))<.62f)wet=true;
        if(wet&&!b->puddle_contact&&!b->slow_shots){
            b->slow_shots=3;b->slow_born_stroke=p->stroke_count;
            b->effect_kind=1;b->effect_time=time;b->effect_serial++;
            slow_applied=true;
        }
        b->puddle_contact=wet;
        b->slow_until=b->slow_shots>0?time+1:0;
        if(enabled&&b->slow_shots>0&&b->is_moving) {
            b->vel.x*=.996f;b->vel.z*=.996f;
        }
        if(!enabled||b->capture_until>0||b->is_in_water||b->is_out_of_bounds||!p->stroke_count||time<b->wildlife_protection)continue;
        for(int kind=0;kind<3;kind++) {
            golf_wild_animal_t *a=&w->animals[kind];if(!a->active||!a->present||a->presence<.95f)continue;
            float d=vec3_distance(b->pos,vec3_add(a->pos,V3(0,b->radius,0)));
            if(d>.82f)b->wildlife_contact&=~(1u<<kind);
            if(d>.62f||time<b->wildlife_cooldown[kind]||(b->wildlife_contact&(1u<<kind)))continue;
            b->wildlife_contact|=1u<<kind;b->wildlife_cooldown[kind]=time+6;b->wildlife_hits[kind]++;
            a->action=kind+1;a->action_time=time;
            vec3 facing=vec3_sub(b->pos,a->pos);facing.y=0;if(vec3_length(facing)>.01f)a->forward=vec3_normalize(facing);
            if(kind==0) {
                puddle(w,a->pos);b->slow_shots=3;b->slow_born_stroke=p->stroke_count;
                b->slow_until=time+1;b->vel=vec3_scale(b->vel,.55f);
                if(!slow_applied){b->effect_kind=1;b->effect_time=time;b->effect_serial++;}
            }else if(kind==1)capture(b,2,vec3_add(w->spawn,V3(0,b->radius,0)),time,1.15f);
            else capture(b,3,random_destination(w,p,seed),time,.85f);
            b->wildlife_protection=time+.4f;break;
        }
        if(b->capture_until>0)continue;
        for(int j=0;j<w->portal_count;j++) {
            golf_portal_t *a=&w->portals[j];if(!a->active||!b->is_moving||time<b->portal_cooldown||vec3_distance(b->pos,vec3_add(a->pos,V3(0,b->radius,0)))>.52f)continue;
            for(int k=0;k<w->portal_count;k++)if(w->portals[k].active&&w->portals[k].pair==a->pair&&w->portals[k].end!=a->end) {
                capture(b,4,vec3_add(w->portals[k].pos,V3(0,b->radius,0)),time,.35f);b->portal_cooldown=time+3;break;
            }
            break;
        }
        if(b->capture_until>0||!b->is_moving)continue;
        for(int j=0;j<w->wind_count;j++) {
            golf_wind_zone_t *z=&w->wind[j];vec3 d=vec3_sub(b->pos,z->pos);
            if(fabsf(d.x)<z->size.x&&fabsf(d.z)<z->size.z&&fabsf(d.y)<z->size.y)
                b->vel.x+=z->strength*(.55f+.45f*sinf(time*.8f+j))/120;
        }
    }
    finish_shots(w,players,count);
    // The puddle's lifetime is independent of each player's three-shot debuff.
}
