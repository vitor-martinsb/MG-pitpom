#include "golf/seasonal.h"
#include <math.h>
#include <string.h>
static uint32_t mix(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;return x;}
void golf_season_prepare(golf_season_t *s,const golf_navigation_t *nav,uint32_t seed,bool enabled,vec3 start,const golf_wildlife_t *wildlife){
    memset(s,0,sizeof(*s));s->enabled=enabled;
    if(!enabled||!nav||!nav->count)return;
    const int kinds[]={SEASON_GIFT,SEASON_SNOWMAN,SEASON_PORTAL,SEASON_PORTAL,SEASON_CANDY,SEASON_SLEIGH,SEASON_SNOWBALL,SEASON_STAR,SEASON_ICE};
    for(int k=0;k<9;k++)for(int n=0;n<nav->count;n++){
        int index=(int)((mix(seed+k*197u)+(uint32_t)n)%nav->count);vec3 p=nav->nodes[index].pos,hit;
        if(!nav->nodes[index].reachable||vec3_distance(p,nav->hole)<2.5f)continue;
        bool clear=golf_nav_floor(nav->floor,p,&hit,.8f);if(!clear)continue;
        for(int j=0;j<s->count;j++)if(vec3_distance(s->items[j].pos,p)<2.6f)clear=false;
        /* Keep the tee and its first approach clear, independently of map IDs. */
        if(vec3_distance(p,start)<2.5f)clear=false;
        if(wildlife){
            float radius=kinds[k]==SEASON_SLEIGH||kinds[k]==SEASON_SNOWBALL?.92f:kinds[k]==SEASON_CANDY?.70f:kinds[k]==SEASON_SNOWMAN?.62f:.65f;
            if(!golf_wildlife_safe(wildlife,p,radius))clear=false;
            for(int j=0;j<wildlife->portal_count;j++)if(wildlife->portals[j].active&&vec3_distance(p,wildlife->portals[j].pos)<1.5f)clear=false;
            for(int j=0;j<GOLF_WILDLIFE_COUNT;j++)if(wildlife->animals[j].active&&vec3_distance(p,wildlife->animals[j].pos)<1.5f)clear=false;
        }
        if(!clear)continue;
        s->items[s->count++]=(golf_season_item_t){kinds[k],hit,(mix(seed+k*31u)%628)/100.f,-100};break;
    }
    /* A solitary gift never acts as a one-way portal. */
    int portals=0;for(int i=0;i<s->count;i++)if(s->items[i].kind==SEASON_PORTAL)portals++;
    if(portals!=2)for(int i=0;i<s->count;i++)if(s->items[i].kind==SEASON_PORTAL)s->items[i].kind=SEASON_GIFT;
}
vec3 golf_season_position(const golf_season_item_t *o,float time){
    vec3 p=o->pos;float a=time*.65f+o->phase;
    if(o->kind==SEASON_SNOWMAN)p.x+=sinf(a)*.25f;
    if(o->kind==SEASON_SLEIGH)p.x+=sinf(a)*.55f;
    if(o->kind==SEASON_SNOWBALL)p.z+=sinf(a)*.55f;
    return p;
}
void golf_season_tick(golf_season_t *s,golf_player_t *players,int count,float time){
    if(!s->enabled)return;
    for(int i=0;players&&count>0&&i<GOLF_MAX_PLAYERS;i++)if(s->ids[i]){
        bool found=false;for(int n=0;n<count;n++)if(players[n].connected&&players[n].id==s->ids[i])found=true;
        if(!found){s->ids[i]=0;memset(s->cooldown[i],0,sizeof(s->cooldown[i]));}
    }
    for(int n=0;n<count;n++){
        golf_player_t *p=&players[n];golf_ball_t *b=&p->ball;
        if(!p->id||!p->connected||!p->stroke_count||b->is_in_hole||b->is_in_water||b->is_out_of_bounds||b->capture_until)continue;
        int slot=-1;for(int i=0;i<GOLF_MAX_PLAYERS;i++)if(s->ids[i]==p->id){slot=i;break;}
        if(slot<0)for(int i=0;i<GOLF_MAX_PLAYERS;i++)if(!s->ids[i]){slot=i;s->ids[i]=p->id;break;}
        if(slot<0)continue;
        for(int i=0;i<s->count;i++){
            golf_season_item_t *o=&s->items[i];vec3 q=golf_season_position(o,time);q.y+=b->radius;
            vec3 d=vec3_sub(b->pos,q);float distance=vec3_length(d),radius=o->kind==SEASON_ICE?.62f:.36f;
            if(o->kind==SEASON_CANDY){vec3 axis=V3(cosf(time*.7f+o->phase),0,sinf(time*.7f+o->phase));float along=golf_clampf(vec3_dot(d,axis),-.48f,.48f);d=vec3_sub(d,vec3_scale(axis,along));distance=vec3_length(d);radius=.20f;}
            if(distance>=radius)continue;
            if(o->kind==SEASON_ICE){b->season_ice_until=time+.12f;continue;}
            if(time<s->cooldown[slot][i])continue;s->cooldown[slot][i]=time+1.8f;o->action_time=time;
            if(o->kind==SEASON_PORTAL){
                for(int j=0;j<s->count;j++)if(j!=i&&s->items[j].kind==SEASON_PORTAL){
                    b->capture_kind=4;b->capture_target=vec3_add(s->items[j].pos,V3(0,b->radius,0));b->capture_until=time+.35f;
                    b->captured=true;b->is_moving=true;b->vel=V3(0,0,0);b->portal_cooldown=time+2;
                    s->cooldown[slot][j]=time+2;break;
                }
            }else{
                d.y=0;if(vec3_length(d)<.001f)d=V3(1,0,0);d=vec3_normalize(d);
                if(o->kind==SEASON_GIFT){float x=b->vel.x,z=b->vel.z,a=.18f*sinf(o->phase+1);b->vel.x=x*cosf(a)-z*sinf(a);b->vel.z=x*sinf(a)+z*cosf(a);}
                else if(o->kind==SEASON_STAR)b->vel=vec3_add(b->vel,vec3_scale(d,.9f));
                else {float approach=vec3_dot(b->vel,d);if(approach<0)b->vel=vec3_sub(b->vel,vec3_scale(d,1.5f*approach));b->pos=vec3_add(q,vec3_scale(d,radius+.01f));}
                float speed=vec3_length(b->vel);if(speed>12)b->vel=vec3_scale(b->vel,12/speed);
                b->is_moving=true;b->resting_static=false;b->time_going_slow=0;
            }
            b->effect_kind=7+o->kind;b->effect_time=time;b->effect_serial++;
        }
    }
}
