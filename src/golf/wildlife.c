#include "golf/wildlife.h"
#include <float.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

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
    if(vec3_distance(p,w->spawn)<2||vec3_distance(p,w->hole)<1.8f||vec3_distance(p,cat)<1.6f||vec3_distance(p,dog)<1.6f)return false;
    for(int i=0;i<until;i++)if(w->animals[i].active&&vec3_distance(p,w->animals[i].a)<2.2f)return false;
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
    for(int kind=0;kind<3;kind++)if(present[kind]) {
        float score=FLT_MAX;int best=-1;
        for(int j=0;j<nav->count;j++) {
            vec3 p=nav->nodes[j].pos;float d=vec3_distance(p,wanted[kind]);
            if(!nav->nodes[j].reachable||d>=score||!separated(w,p,kind,cat,dog)||!golf_wildlife_safe(w,p,.48f))continue;
            score=d;best=j;
        }
        if(best<0)continue;
        golf_wild_animal_t *a=&w->animals[kind];a->active=true;a->a=a->b=a->pos=nav->nodes[best].pos;
        a->forward=V3(0,0,-1);a->action_time=-100;a->clock=kind*1.7f;
        // A short, fully sampled corridor avoids walls, water and moving sweeps.
        for(int j=0;j<nav->count;j++) {
            vec3 p=nav->nodes[j].pos;float d=vec3_distance(a->a,p);
            if(!nav->nodes[j].reachable||d<.7f||d>1.8f||!separated(w,p,kind,cat,dog)||!golf_wildlife_safe(w,p,.48f)||!golf_nav_segment(floor,a->a,p,.48f))continue;
            bool safe=true;for(int k=0;k<=8;k++)if(!golf_wildlife_safe(w,vec3_add(a->a,vec3_scale(vec3_sub(p,a->a),k/8.f)),.48f))safe=false;
            if(safe){a->b=p;break;}
        }
    }
    for(int i=0;i<w->portal_count;i++)w->portals[i].active=golf_wildlife_safe(w,w->portals[i].pos,.26f);
}
static void animate(golf_wildlife_t *w,float time) {
    float dt=w->time<0?0:golf_clampf(time-w->time,0,.1f);w->time=time;
    for(int kind=0;kind<3;kind++) {
        golf_wild_animal_t *a=&w->animals[kind];if(!a->active)continue;
        float age=time-a->action_time;
        if(age>=0&&age<1.1f){a->walking=false;continue;}
        a->clock+=dt;float period=8+kind*1.7f,p=fmodf(a->clock,period)/period;
        float t=p<.4f?p/.4f:p<.5f?1:p<.9f?1-(p-.5f)/.4f:0;
        t=t*t*(3-2*t);vec3 old=a->pos;
        a->pos=vec3_add(a->a,vec3_scale(vec3_sub(a->b,a->a),t));
        vec3 hit;if(golf_nav_floor(w->floor,a->pos,&hit,0))a->pos.y=hit.y;
        vec3 velocity=vec3_sub(a->pos,old);velocity.y=0;a->walking=vec3_length(velocity)>.00001f;
        if(a->walking)a->forward=vec3_normalize(velocity);
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
        if(b->slow_until>time&&b->is_moving) {
            b->vel.x*=.996f;b->vel.z*=.996f;
        }
        if(!enabled||b->capture_until>0||b->is_in_water||b->is_out_of_bounds||!p->stroke_count||time<b->wildlife_protection)continue;
        for(int kind=0;kind<3;kind++) {
            golf_wild_animal_t *a=&w->animals[kind];if(!a->active)continue;
            float d=vec3_distance(b->pos,vec3_add(a->pos,V3(0,b->radius,0)));
            if(d>.82f)b->wildlife_contact&=~(1u<<kind);
            if(d>.62f||time<b->wildlife_cooldown[kind]||(b->wildlife_contact&(1u<<kind)))continue;
            b->wildlife_contact|=1u<<kind;b->wildlife_cooldown[kind]=time+6;b->wildlife_hits[kind]++;
            a->action=kind+1;a->action_time=time;
            vec3 facing=vec3_sub(b->pos,a->pos);facing.y=0;if(vec3_length(facing)>.01f)a->forward=vec3_normalize(facing);
            if(kind==0) {
                b->slow_until=time+3.8f;b->vel=vec3_scale(b->vel,.55f);
                b->effect_kind=1;b->effect_time=time;b->effect_serial++;
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
}
