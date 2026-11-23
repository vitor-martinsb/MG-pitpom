#include "golf/wildlife.h"
#include "golf/alfredo.h"
#include <float.h>
#include <string.h>
static uint32_t random_word(uint32_t n){n^=n>>16;n*=0x7feb352du;n^=n>>15;n*=0x846ca68bu;return n^(n>>16);}
static golf_player_t *owner(golf_player_t *p,int n,uint32_t id){for(int i=0;i<n;i++)if(p[i].id==id)return &p[i];return NULL;}
static bool safe(const golf_wildlife_t *w,vec3 p){return golf_wildlife_safe(w,p,.30f)&&vec3_distance(p,w->hole)>1&&vec3_distance(p,w->spawn)>1;}
static bool passage(const golf_wildlife_t *w,vec3 a,vec3 b){
    if(!golf_nav_segment(w->floor,a,b,.30f))return false;
    int steps=(int)ceilf(vec3_distance(a,b)/.10f);if(steps<1)steps=1;
    for(int i=0;i<=steps;i++){vec3 p=vec3_add(a,vec3_scale(vec3_sub(b,a),i/(float)steps)),floor;if(!golf_nav_floor(w->floor,p,&floor,0)||!safe(w,floor))return false;}
    return true;
}
static int nearest(const golf_wildlife_t *w,vec3 p){
    int best=-1;float distance=1.4f;const golf_navigation_t *n=w->nav;
    for(int i=0;i<n->count;i++){float d=vec3_distance(n->nodes[i].pos,p);if(n->nodes[i].reachable&&w->companions.dog_nodes[i]&&d<distance&&passage(w,p,n->nodes[i].pos)){distance=d;best=i;}}
    return best;
}
/* Follow graph edges with canine clearance, never a straight line through a wall.
   The bounded search also prevents a capture from carrying a ball across a world. */
static bool route(golf_wildlife_t *w,bool random,uint32_t seed){
    golf_companions_t *c=&w->companions;golf_companion_t *a=&c->smanata;const golf_navigation_t *n=w->nav;
    int first=nearest(w,a->pos),goal=random?-1:nearest(w,a->home);if(first<0||(!random&&goal<0))return false;
    short parent[GOLF_NAV_NODES],queue[GOLF_NAV_NODES];
    for(int i=0;i<n->count;i++)parent[i]=-2;
    int read=0,used=1,choices=0;queue[0]=(short)first;parent[first]=-1;
    const int dx[]={-1,0,1,-1,1,-1,0,1},dz[]={-1,-1,-1,0,0,1,1,1};
    while(read<used){
        int i=queue[read++];vec3 p=n->nodes[i].pos;
        if(random&&vec3_distance(p,a->pos)>.9f&&vec3_distance(p,a->home)<5.5f){choices++;if(random_word(seed^((uint32_t)choices*0x9e3779b9u))%(unsigned)choices==0)goal=i;}
        if(!random&&i==goal)break;
        int cell=n->nodes[i].cell;
        for(int k=0;k<8;k++)if(c->dog_edges[i]&(1u<<k)){
            int next=cell+dz[k]*n->width+dx[k];if(next<0||next>=GOLF_NAV_CELLS)continue;int j=n->cells[next];
            if(j<0||parent[j]!=-2||!n->nodes[j].reachable||vec3_distance(n->nodes[j].pos,a->home)>6)continue;
            if(!c->dog_nodes[j])continue;
            parent[j]=(short)i;queue[used++]=(short)j;
        }
    }
    if(goal<0||parent[goal]==-2)return false;
    c->path_count=0;for(int i=goal;i>=0;i=parent[i])c->path[c->path_count++]=(short)i;
    for(int i=0;i<c->path_count/2;i++){short v=c->path[i];c->path[i]=c->path[c->path_count-1-i];c->path[c->path_count-1-i]=v;}
    c->path_index=0;c->goal=random?n->nodes[goal].pos:a->home;return true;
}
void golf_companions_init(golf_wildlife_t *w,vec3 cat,vec3 dog){
    golf_companions_t *c=&w->companions;memset(c,0,sizeof(*c));c->time=-1;
    if(!w->nav||!w->floor)return;
    for(int pet=0;pet<2;pet++){
        golf_companion_t *a=pet?&c->smanata:&c->benedita;float best=FLT_MAX;
        vec3 wanted=vec3_add(w->spawn,vec3_scale(vec3_sub(w->hole,w->spawn),pet?.65f:.4f));
        for(int i=0;i<w->nav->count;i++){
            vec3 p=w->nav->nodes[i].pos;float score=vec3_distance(p,wanted);
            if(!w->nav->nodes[i].reachable||score>=best||!safe(w,p)||vec3_distance(p,w->spawn)<2||vec3_distance(p,w->hole)<1.5f)continue;
            bool apart=!pet||!c->benedita.active||vec3_distance(p,c->benedita.pos)>1.35f;
            for(int k=0;k<GOLF_WILDLIFE_COUNT;k++)if(w->animals[k].active&&vec3_distance(p,w->animals[k].a)<1.1f)apart=false;
            if(!apart||vec3_distance(p,cat)<1.2f||vec3_distance(p,dog)<1.2f)continue;best=score;a->home=a->pos=a->draw_pos=p;a->active=true;
        }
        a->forward=vec3_sub(w->spawn,a->pos);a->forward.y=0;if(vec3_length(a->forward)>.01f)a->forward=vec3_normalize(a->forward);else a->forward=V3(0,0,-1);
        a->look=a->forward;
    }
    // Validate the canine graph once per field, not once per forecast/tick.
    // These immutable edges are shared with isolated bot copies of the state.
    if(c->smanata.active){
        const golf_navigation_t *n=w->nav;const int dx[]={-1,0,1,-1,1,-1,0,1},dz[]={-1,-1,-1,0,0,1,1,1};
        for(int i=0;i<n->count;i++)c->dog_nodes[i]=n->nodes[i].reachable&&vec3_distance(n->nodes[i].pos,c->smanata.home)<=6&&safe(w,n->nodes[i].pos);
        for(int i=0;i<n->count;i++)if(c->dog_nodes[i])for(int k=0;k<4;k++)if(n->nodes[i].edges&(1u<<k)){
            int cell=n->nodes[i].cell+dz[k]*n->width+dx[k];if(cell<0||cell>=GOLF_NAV_CELLS)continue;int j=n->cells[cell];
            if(j>=0&&c->dog_nodes[j]&&passage(w,n->nodes[i].pos,n->nodes[j].pos)){c->dog_edges[i]|=1u<<k;c->dog_edges[j]|=1u<<(7-k);}
        }
    }
    golf_alfredo_init(w,cat,dog);
}
vec3 golf_smanata_mouth(const golf_companion_t *a,bool draw){return vec3_add(vec3_add(draw?a->draw_pos:a->pos,vec3_scale(a->forward,.39f)),V3(0,.52f,0));}
static void thaw(golf_player_t *p){
    golf_ball_t *b=&p->ball;b->capture_kind=0;b->capture_until=0;b->captured=false;
    b->vel=b->gaze_velocity;b->rot_vec=b->gaze_rotation;b->rot_vel=b->gaze_spin;
    b->resting_static=false;b->time_going_slow=0;b->is_moving=true;
}
static void gaze_end(golf_companion_t *a,float time){a->player=0;a->state=0;a->cooldown=time+5;a->until=0;}
static void return_home(golf_wildlife_t *w,float time){golf_companion_t *a=&w->companions.smanata;a->player=0;a->state=SMANATA_RETURNING;a->until=time;w->companions.goal=a->home;if(!route(w,false,0))w->companions.path_count=0;}
static bool drop(golf_wildlife_t *w,golf_player_t *p,float time){
    golf_companion_t *a=&w->companions.smanata;vec3 floor;
    if(!golf_nav_floor(w->floor,a->pos,&floor,GOLF_BALL_RADIUS))return false;
    golf_ball_t *b=&p->ball;b->pos=b->draw_pos=b->start_pos=vec3_add(floor,V3(0,b->radius,0));b->vel=b->rot_vec=V3(0,0,0);b->rot_vel=0;
    b->capture_kind=0;b->capture_until=0;b->captured=b->is_moving=b->is_out_of_bounds=b->is_in_water=false;
    b->time_going_slow=0;b->resting_static=false;b->time_out_of_bounds=-1;b->time_out_of_water=1;b->collision_grace=.3f;
    b->first_shot_complete=p->stroke_count>0;b->wildlife_protection=time+1;b->cat_cooldown=b->dog_cooldown=time+1;
    b->effect_time=time;b->effect_serial++;return true;
}
bool golf_smanata_release(golf_wildlife_t *w,golf_player_t *p,float time){
    golf_companion_t *a=&w->companions.smanata;
    if(!p||!p->connected||p->ball.is_in_hole||p->ball.capture_kind!=GOLF_CAPTURE_SMANATA||!p->ball.captured||!a->active||a->state!=SMANATA_HOLDING||a->player!=p->id)return false;
    if(!drop(w,p,time))return false;return_home(w,time);return true;
}
static bool move(golf_wildlife_t *w,vec3 target,float dt){
    golf_companion_t *a=&w->companions.smanata;vec3 d=vec3_sub(target,a->pos);float distance=vec3_length(d),step=fminf(distance,4.2f*dt);
    if(distance<.025f){a->pos=target;a->speed=0;return true;}
    vec3 next=vec3_add(a->pos,vec3_scale(d,step/distance)),floor;
    if(!golf_nav_floor(w->floor,next,&floor,0)||!safe(w,floor)||!golf_nav_segment(w->floor,a->pos,floor,.30f)){a->speed=0;return false;}
    a->pos=floor;d.y=0;if(vec3_length(d)>.01f)a->forward=vec3_normalize(d);a->speed=dt>0?step/dt:0;a->stride+=step*8;return distance<=step+.025f;
}
static bool eligible(golf_player_t *p){return p&&p->id&&p->connected&&p->stroke_count>0&&!p->ball.is_in_hole&&!p->ball.is_in_water&&!p->ball.is_out_of_bounds&&(!p->ball.capture_until||p->ball.capture_kind==GOLF_CAPTURE_BENEDITA);}
void golf_companions_tick(golf_wildlife_t *w,golf_player_t *players,int count,float time,uint32_t seed,bool enabled){
    golf_companions_t *c=&w->companions;float dt=c->time<0?0:golf_clampf(time-c->time,0,.1f);c->time=time;
    golf_companion_t *s=&c->smanata,*b=&c->benedita;s->clock=b->clock=time;
    golf_player_t *held=owner(players,count,s->player);
    if(s->active&&(s->state==SMANATA_CARRYING||s->state==SMANATA_HOLDING)&&(!held||!held->connected||held->ball.capture_kind!=GOLF_CAPTURE_SMANATA)){
        if(held&&held->ball.capture_kind==GOLF_CAPTURE_SMANATA)drop(w,held,time);return_home(w,time);held=NULL;
    }
    if(s->active&&enabled&&s->state==SMANATA_IDLE&&time>=s->cooldown){
        float best=2.4f;for(int i=0;i<count;i++)if(eligible(&players[i])&&players[i].ball.is_moving&&time>=players[i].ball.wildlife_protection){
            vec3 p=players[i].ball.pos;p.y-=players[i].ball.radius;float distance=vec3_distance(p,s->pos);
            if(distance<best&&safe(w,p)&&passage(w,s->pos,p)){best=distance;s->player=players[i].id;}
        }
        if(s->player){s->state=SMANATA_CHASING;s->until=time+4;}
    }
    if(s->active&&s->state==SMANATA_CHASING){
        golf_player_t *p=owner(players,count,s->player);
        if(!eligible(p)||time>s->until){return_home(w,time);}else{
            vec3 target=p->ball.pos;target.y-=p->ball.radius;
            if(vec3_distance(target,s->home)>4||!safe(w,target)||!passage(w,s->pos,target)){return_home(w,time);}
            else{
                move(w,target,dt);
                if(vec3_distance(s->pos,target)<.52f){
                    if(p->ball.capture_kind==GOLF_CAPTURE_BENEDITA)gaze_end(b,time);
                    p->ball.capture_kind=GOLF_CAPTURE_SMANATA;p->ball.capture_until=FLT_MAX;p->ball.captured=p->ball.is_moving=true;
                    p->ball.vel=p->ball.rot_vec=V3(0,0,0);p->ball.rot_vel=0;p->ball.resting_static=false;
                    p->ball.effect_kind=GOLF_EFFECT_SMANATA;p->ball.effect_time=time;p->ball.effect_serial++;
                    s->state=route(w,true,seed^(++s->cycles*0x9e3779b9u))?SMANATA_CARRYING:SMANATA_HOLDING;held=p;
                }
            }
        }
    }
    if(s->active&&(s->state==SMANATA_CARRYING||s->state==SMANATA_RETURNING)){
        if(c->path_index<c->path_count){
            vec3 target=w->nav->nodes[c->path[c->path_index]].pos;
            if(move(w,target,dt))c->path_index++;
            else if(!s->speed&&dt>0){if(s->state==SMANATA_CARRYING)s->state=SMANATA_HOLDING;else if(time>s->until+.5f){route(w,false,0);s->until=time;}}
        }else if(move(w,c->goal,dt)){
            s->speed=0;
            if(s->state==SMANATA_CARRYING)s->state=SMANATA_HOLDING;
            else{s->state=SMANATA_COOLDOWN;s->cooldown=time+5;}
        }else if(s->state==SMANATA_RETURNING&&!s->speed&&time>s->until+.5f){route(w,false,0);s->until=time;}
    }else if(s->state!=SMANATA_CHASING)s->speed=0;
    if(s->state==SMANATA_COOLDOWN&&time>=s->cooldown)s->state=SMANATA_IDLE;
    if(held&&(s->state==SMANATA_CARRYING||s->state==SMANATA_HOLDING)){
        held->ball.pos=held->ball.draw_pos=golf_smanata_mouth(s,false);held->ball.vel=held->ball.rot_vec=V3(0,0,0);held->ball.rot_vel=0;
        held->ball.capture_until=FLT_MAX;held->ball.captured=held->ball.is_moving=true;
    }
    golf_player_t *frozen=owner(players,count,b->player);
    if(b->state){
        if(!frozen||!frozen->connected||frozen->ball.capture_kind!=GOLF_CAPTURE_BENEDITA){if(frozen&&frozen->ball.capture_kind==GOLF_CAPTURE_BENEDITA)thaw(frozen);gaze_end(b,time);}
        else if(time>=b->until){thaw(frozen);gaze_end(b,time);}
        else{frozen->ball.vel=frozen->ball.rot_vec=V3(0,0,0);frozen->ball.rot_vel=0;frozen->ball.is_moving=true;}
    }
    if(b->active&&!b->state&&enabled){
        golf_player_t *target=NULL;float best=4;
        for(int i=0;i<count;i++)if(eligible(&players[i])&&!players[i].ball.capture_until&&players[i].ball.is_moving&&time>=players[i].ball.wildlife_protection){
            float d=vec3_distance(b->pos,players[i].ball.pos);if(d<best){best=d;target=&players[i];}
        }
        if(target){
            vec3 d=vec3_sub(target->ball.pos,b->pos);d.y=0;if(vec3_length(d)>.01f){d=vec3_normalize(d);b->look=d;}
            if(time>=b->cooldown&&best<2.7f&&vec3_dot(d,b->forward)>.42f){
                vec3 ground=target->ball.pos;ground.y-=target->ball.radius;
                if(golf_nav_segment(w->floor,b->pos,ground,.12f)){
                    golf_ball_t *ball=&target->ball;ball->gaze_velocity=ball->vel;ball->gaze_rotation=ball->rot_vec;ball->gaze_spin=ball->rot_vel;
                    ball->vel=ball->rot_vec=V3(0,0,0);ball->rot_vel=0;ball->capture_kind=GOLF_CAPTURE_BENEDITA;ball->capture_until=time+3;
                    ball->captured=false;ball->is_moving=true;ball->resting_static=false;ball->effect_kind=GOLF_EFFECT_BENEDITA;ball->effect_time=time;ball->effect_serial++;
                    b->state=1;b->player=target->id;b->until=time+3;
                }
            }
        }
    }
    s->draw_pos=s->pos;b->draw_pos=b->pos;
}
