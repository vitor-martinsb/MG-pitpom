#include "bot.h"
#include <float.h>
#include <math.h>
#include <string.h>

static uint32_t hash(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
static const int dx[]={-1,0,1,-1,1,-1,0,1},dz[]={-1,-1,-1,0,0,1,1,1};
#define BOT_LINKS 16384
typedef struct bot_link {short from,to;float cost,speed;bool portal;vec3 aim;} bot_link_t;
/* Planner-only graph: animal patrols and respawns retain continuous-floor safety. */
static struct {
    const golf_navigation_t *nav;golf_level_t *level;vec3 hole;bool portals;
    int count,base_count,component[GOLF_NAV_NODES];float cost[GOLF_NAV_NODES];
    golf_navigation_t navigation;
    short heads[GOLF_NAV_CELLS],next[GOLF_NAV_NODES],neighbor[GOLF_NAV_NODES][8];
    struct {golf_bvh_aabb_t bounds;vec3 normal;} ramps[64];int ramp_count;
    bot_link_t links[BOT_LINKS];int link_count;
    int movers[1024],mover_count;
} route;
#include "bot_layers.h"
static float horizontal(vec3 a,vec3 b){float x=a.x-b.x,z=a.z-b.z;return sqrtf(x*x+z*z);}
static int nearest(const golf_navigation_t *nav,vec3 p){
    int best=-1;float distance=FLT_MAX;
    for(int i=0;i<nav->count;i++){float d=vec3_distance(p,nav->nodes[i].pos);if(d<distance){distance=d;best=i;}}
    return best;
}
static float power_for_speed(golf_physics_world_t *w,float speed){
    float gs=CFG_NUM(w->config,"aim_green_speed"),ys=CFG_NUM(w->config,"aim_yellow_speed"),rs=CFG_NUM(w->config,"aim_red_speed"),ds=CFG_NUM(w->config,"aim_dark_red_speed");
    float gp=CFG_NUM(w->config,"aim_green_power"),yp=CFG_NUM(w->config,"aim_yellow_power"),rp=CFG_NUM(w->config,"aim_red_power");
    return golf_clampf(speed<ys?(speed-gs)/(ys-gs)*gp:speed<rs?gp+(speed-ys)/(rs-ys)*(yp-gp):yp+(speed-rs)/(ds-rs)*(rp-yp),0,1);
}
static void link_nodes(int from,int to,float cost,float speed,bool portal){
    if(from<0||to<0||route.link_count>=BOT_LINKS)return;
    route.links[route.link_count++]=(bot_link_t){(short)from,(short)to,cost,speed,portal,route.navigation.nodes[to].pos};
}
static bool route_connected(const golf_navigation_t *nav,vec3 start){
    int goal=nearest(nav,nav->hole),first=nearest(nav,start);if(goal<0||first<0)return false;
    bool reachable[GOLF_NAV_NODES]={0};reachable[goal]=true;
    for(int pass=0;pass<nav->count;pass++){
        bool changed=false;
        for(int i=0;i<nav->count;i++)if(!reachable[i])for(int k=0;k<8;k++)if((nav->nodes[i].edges&(1u<<k))&&reachable[route.neighbor[i][k]]){reachable[i]=true;changed=true;break;}
        for(int k=0;k<route.link_count;k++){
            bot_link_t *l=&route.links[k];int a=l->from,b=l->to;
            if(reachable[b]&&!reachable[a]){reachable[a]=true;changed=true;}
        }
        if(!changed)break;
    }
    return reachable[first];
}
static void build_route(golf_physics_world_t *world,const golf_mechanics_t *m,const golf_navigation_t *nav){
    if(route.nav==nav&&route.level==world->level&&route.base_count==nav->count&&route.portals==m->enabled&&vec3_distance(route.hole,nav->hole)<.001f)return;
    memset(&route,0,sizeof(route));route.nav=nav;route.level=world->level;route.base_count=nav->count;route.hole=nav->hole;route.portals=m->enabled;
    bot_layers(nav);nav=&route.navigation;route.count=nav->count;
    for(int i=0;i<world->level->entities.length&&route.mover_count<1024;i++){
        golf_entity_t *e=&world->level->entities.data[i];
        if(e->type!=MODEL_ENTITY&&e->type!=GEO_ENTITY&&e->type!=WATER_ENTITY)continue;
        if(e->type==MODEL_ENTITY&&e->model.ignore_physics)continue;
        golf_movement_t *movement=golf_entity_get_movement(e);
        if(movement&&movement->type!=GOLF_MOVEMENT_NONE)route.movers[route.mover_count++]=i;
        if(movement&&movement->type==GOLF_MOVEMENT_RAMP&&route.ramp_count<64){
            golf_bvh_t temporary;golf_bvh_init(&temporary);
            golf_bvh_node_info_t info=golf_bvh_node_info(&temporary,i,world->level,e,movement->length*.5f-movement->t0);
            vec3 top=V3(0,0,0);
            for(int f=0;f<temporary.faces.length;f++){
                golf_bvh_face_t *face=&temporary.faces.data[f];vec3 n=vec3_normalize(vec3_cross(vec3_sub(face->b,face->a),vec3_sub(face->c,face->a)));
                if(n.y>.5f&&n.y<.98f&&n.y>top.y)top=n;
            }
            if(top.y>0){route.ramps[route.ramp_count].bounds=info.aabb;route.ramps[route.ramp_count++].normal=top;}
            vec_deinit(&temporary.faces);vec_deinit(&temporary.node_infos);vec_deinit(&temporary.nodes);
        }
    }
    for(int i=0;i<nav->count;i++){route.component[i]=-1;route.cost[i]=FLT_MAX;}
    int queue[GOLF_NAV_NODES],components=0;
    for(int first=0;first<nav->count;first++)if(route.component[first]<0){
        int read=0,used=0;queue[used++]=first;route.component[first]=components;
        while(read<used){int i=queue[read++],cell=nav->nodes[i].cell;
            for(int k=0;k<8;k++)if(nav->nodes[i].edges&(1u<<k)){
                int j=route.neighbor[i][k];
                if(route.component[j]<0){route.component[j]=components;queue[used++]=j;}
            }
        }components++;
    }
    /* Ballistics suggest takeoff speed; original 120 Hz collision physics
     * validates every actual shot, including its ramp and safe landing. */
    if(components>1)for(int pass=0;pass<2;pass++){
      int slots=pass?components*8:8;
      for(int i=0;i<nav->count;i++)if(nav->nodes[i].edges!=255){
        int best[slots];float distances[slots];
        for(int k=0;k<slots;k++){best[k]=-1;distances[k]=FLT_MAX;}
        vec3 a=nav->nodes[i].pos;
        for(int j=0;j<nav->count;j++)if(route.component[i]!=route.component[j]){
            vec3 b=nav->nodes[j].pos;float d=horizontal(a,b),rise=b.y-a.y;
            if(d<.8f||d>16||rise>4||rise<-6)continue;
            int sector=(int)((atan2f(b.x-a.x,b.z-a.z)+MF_PI)*8/(2*MF_PI))%8;
            int slot=(pass?route.component[j]*8:0)+sector;
            float score=d+fabsf(rise)*.4f;if(score<distances[slot]){distances[slot]=score;best[slot]=j;}
        }
        for(int k=0;k<slots;k++)if(best[k]>=0){
            int j=best[k];vec3 b=nav->nodes[j].pos,dir=vec3_normalize(V3(b.x-a.x,0,b.z-a.z));
            golf_bvh_face_t launch_face;float launch_t=FLT_MAX;int launch_index;
            if(!golf_bvh_ray_test(world->static_bvh,vec3_add(a,V3(0,.06f,0)),V3(0,-1,0),&launch_t,&launch_index,&launch_face))continue;
            vec3 launch_normal=vec3_normalize(vec3_cross(vec3_sub(launch_face.b,launch_face.a),vec3_sub(launch_face.c,launch_face.a)));
            float slope=launch_normal.y>.1f?-(launch_normal.x*dir.x+launch_normal.z*dir.z)/launch_normal.y:0;
            float d=horizontal(a,b),rise=b.y-a.y;
            for(int r=0;r<route.ramp_count;r++){
                golf_bvh_aabb_t box=route.ramps[r].bounds;vec3 n=route.ramps[r].normal;
                vec3 uphill=vec3_normalize(V3(-n.x,0,-n.z));
                bool lane=fabsf(uphill.x)<.2f?(a.x>box.min.x+.12f&&a.x<box.max.x-.12f):(a.z>box.min.z+.12f&&a.z<box.max.z-.12f);
                if(lane&&vec3_dot(uphill,dir)>.92f&&a.x>box.min.x-1.2f&&a.x<box.max.x+1.2f&&a.z>box.min.z-1.2f&&a.z<box.max.z+1.2f&&fabsf(a.y-box.min.y)<1.5f)
                    slope=fmaxf(slope,-(n.x*dir.x+n.z*dir.z)/n.y);
            }
            bool water_crossing=false;
            if(d<5&&fabsf(rise)<.4f){
                for(int sample=1;sample<4;sample++){
                    vec3 p=vec3_add(a,vec3_scale(vec3_sub(b,a),sample/4.f));golf_bvh_face_t f;float t=FLT_MAX;int index;
                    if(golf_bvh_ray_test(world->static_bvh,vec3_add(p,V3(0,.3f,0)),V3(0,-1,0),&t,&index,&f)&&t<.8f&&f.entity&&(f.entity->type==WATER_ENTITY||(f.entity->type==GEO_ENTITY&&f.entity->geo.geo.is_water)))water_crossing=true;
                }
            }
            if(slope<.04f&&rise>-.12f&&!water_crossing)continue;
            if(slope<.04f){
                golf_bvh_face_t wall;float hit=FLT_MAX;int index;
                if(golf_bvh_ray_test(world->static_bvh,vec3_add(a,V3(0,GOLF_BALL_RADIUS,0)),dir,&hit,&index,&wall)&&hit<2&&fabsf(vec3_normalize(vec3_cross(vec3_sub(wall.b,wall.a),vec3_sub(wall.c,wall.a))).y)<.65f)continue;
            }
            float denominator=2*(d*slope-rise)/(1+slope*slope);
            if(denominator<=.02f&&!water_crossing)continue;
            float speed=water_crossing?fminf(18,6+d*2):sqrtf(9.8f*d*d/denominator)*1.15f;
            if(speed>CFG_NUM(world->config,"aim_dark_red_speed")*.98f)continue;
            link_nodes(i,j,d*1.4f+(water_crossing?4:1),speed,false);
        }
      }
      if(route_connected(nav,m->start))break;
    }
    /* Concave return ramps launch away from the landing, then turn the ball
     * back. Seed that approach from the actual steep faces; simulation below
     * still has to climb the complete curved mesh and land on a real green. */
    if(components>1&&!route_connected(nav,m->start))for(int i=0;i<nav->count;i++){
        vec3 a=nav->nodes[i].pos,uphill=V3(0,0,0);float near=1.2f;
        for(int f=0;f<world->static_bvh->faces.length;f++){
            golf_bvh_face_t *face=&world->static_bvh->faces.data[f];
            if(!face->entity||face->entity->type!=GEO_ENTITY||face->vel_scale<=.1f)continue;
            vec3 n=vec3_normalize(vec3_cross(vec3_sub(face->b,face->a),vec3_sub(face->c,face->a)));
            if(n.y<.2f||n.y>.65f)continue;
            vec3 center=vec3_scale(vec3_add(vec3_add(face->a,face->b),face->c),1.f/3);
            float d=horizontal(a,center);
            if(d<near&&center.y>a.y+.2f&&center.y<a.y+1.5f){near=d;uphill=vec3_normalize(V3(-n.x,0,-n.z));}
        }
        if(vec3_length(uphill)<.5f)continue;
        for(int c=0;c<components;c++)if(c!=route.component[i]){
            int best=-1;float distance=12;
            for(int j=0;j<nav->count;j++)if(route.component[j]==c){
                vec3 b=nav->nodes[j].pos;float d=horizontal(a,b);
                if(b.y>a.y+.8f&&b.y<a.y+3.5f&&d<distance){distance=d;best=j;}
            }
            if(best>=0&&route.link_count<BOT_LINKS){
                link_nodes(i,best,distance*1.5f+5,17,false);
                route.links[route.link_count-1].aim=vec3_add(a,vec3_scale(uphill,3));
            }
        }
    }
    if(m->enabled)for(int i=0;i<m->wildlife.portal_count;i++)for(int j=0;j<m->wildlife.portal_count;j++){
        const golf_portal_t *a=&m->wildlife.portals[i],*b=&m->wildlife.portals[j];
        if(a->active&&b->active&&a->pair==b->pair&&a->end!=b->end)
            link_nodes(nearest(nav,a->pos),nearest(nav,b->pos),.7f,3,true);
    }
    int goal=nearest(nav,nav->hole);if(goal<0)return;route.cost[goal]=vec3_distance(nav->nodes[goal].pos,nav->hole);
    bool visited[GOLF_NAV_NODES]={0};
    for(int n=0;n<nav->count;n++){
        int i=-1;float cost=FLT_MAX;for(int j=0;j<nav->count;j++)if(!visited[j]&&route.cost[j]<cost){i=j;cost=route.cost[j];}
        if(i<0)break;visited[i]=true;int cell=nav->nodes[i].cell;
        for(int k=0;k<8;k++){
            int x=cell%nav->width+dx[k],z=cell/nav->width+dz[k];if(x<0||z<0||x>=nav->width||z>=nav->height)continue;
            for(int j=route.heads[z*nav->width+x];j>=0;j=route.next[j])if(route.neighbor[j][7-k]==i){
                float c=cost+vec3_distance(nav->nodes[i].pos,nav->nodes[j].pos);if(c<route.cost[j])route.cost[j]=c;
            }
        }
        for(int k=0;k<route.link_count;k++)if(route.links[k].to==i){bot_link_t *l=&route.links[k];if(cost+l->cost<route.cost[l->from])route.cost[l->from]=cost+l->cost;}
    }


}
static float route_cost(const golf_navigation_t *nav,vec3 p){
    if(route.count)nav=&route.navigation;
    int i=nearest(nav,p);if(i<0)return vec3_distance(p,nav->hole);
    return route.cost[i]<FLT_MAX/2?route.cost[i]+vec3_distance(p,nav->nodes[i].pos):10000+vec3_distance(p,nav->hole);
}
static vec3 target(const golf_navigation_t *nav,vec3 p,float reach,float *launch_speed){
    *launch_speed=0;int i=nearest(nav,p);if(i<0)return nav->hole;
    vec3 best=nav->nodes[i].pos;float cost=route.cost[i];
    vec3 foot=vec3_sub(p,V3(0,GOLF_BALL_RADIUS,0));
    if(vec3_distance(p,nav->hole)<2.3f&&bot_segment(nav->floor,foot,nav->hole,.12f))return nav->hole;
    for(int j=0;j<nav->count;j++)if(route.component[i]==route.component[j]&&route.cost[j]<cost&&vec3_distance(p,nav->nodes[j].pos)<reach&&bot_segment(nav->floor,foot,nav->nodes[j].pos,.12f)){
        best=nav->nodes[j].pos;cost=route.cost[j];
    }
    for(int j=0;j<route.link_count;j++){
        bot_link_t *l=&route.links[j];vec3 launch=nav->nodes[l->from].pos;
        if(vec3_distance(p,launch)<1.1f&&route.cost[l->to]+l->cost<=cost+1.8f){
            best=l->aim;cost=route.cost[l->to];*launch_speed=l->speed;
        }
    }
    return best;
}
void golf_bot_record(golf_bot_memory_t *memory,const golf_player_t *p,vec3 direction,float power){
    memory->pending=(golf_bot_attempt_t){.start=p->ball.start_pos,.direction=direction,.power=power};memory->pending_stroke=p->stroke_count;
}
void golf_bot_observe(golf_bot_memory_t *memory,const golf_player_t *p,const golf_navigation_t *nav){
    if(!memory->pending_stroke||p->ball.is_moving||p->ball.capture_until||memory->observed_stroke==memory->pending_stroke)return;
    golf_bot_attempt_t a=memory->pending;a.end=p->ball.pos;
    a.failed=!p->ball.is_in_hole&&(vec3_distance(a.start,a.end)<.4f||route_cost(nav,a.end)>=route_cost(nav,a.start)-.2f);
    memory->stalled=a.failed?memory->stalled+1:0;memory->attempts[memory->next]=a;memory->next=(memory->next+1)%GOLF_BOT_HISTORY;
    if(memory->count<GOLF_BOT_HISTORY)memory->count++;memory->observed_stroke=memory->pending_stroke;
}
typedef struct trial {golf_player_t player;golf_mechanics_t mechanics;float time,cost,peak;bool safe;} trial_t;
static void moving_world(golf_physics_world_t *w){
    if(w->level->entities.length>1024){golf_physics_build_world(w,true);return;}
    golf_bvh_t *b=w->dynamic_bvh;b->node_infos.length=b->faces.length=0;
    for(int n=0;n<route.mover_count;n++){
        int i=route.movers[n];vec_push(&b->node_infos,golf_bvh_node_info(b,i,w->level,&w->level->entities.data[i],w->time));
    }
    golf_bvh_construct(b,b->node_infos);
}
static trial_t simulate(golf_physics_world_t *world,golf_bvh_t *dynamic,const golf_mechanics_t *m,const golf_navigation_t *nav,const golf_player_t *p,vec3 direction,float power,int horizon){
    trial_t t={.player=*p,.mechanics=*m,.time=world->time,.peak=p->ball.pos.y};
    golf_physics_world_t w=*world;w.dynamic_bvh=dynamic;w.sound=NULL;w.stop_sound=NULL;w.ripple=NULL;w.contacts=NULL;t.mechanics.impact=false;
    if(!golf_physics_shoot(&w,&t.player,direction,power)){t.cost=100000;return t;}
    golf_wildlife_shot(&t.mechanics.wildlife,&t.player);
    moving_world(&w);
    bool danger=false;int water_ticks=0;
    for(int tick=0;tick<horizon;tick++){
        w.time+=1.f/120;if(route.mover_count)moving_world(&w);
        golf_physics_tick_player(&w,&t.player,1.f/120);golf_mechanics_tick(&t.mechanics,&t.player,1,w.time);
        t.peak=fmaxf(t.peak,t.player.ball.pos.y);
        if(t.player.ball.is_in_hole)break;
        if(t.player.ball.is_in_water)water_ticks++;
        if(t.player.ball.is_out_of_bounds||t.player.ball.pos.y<CFG_NUM(w.config,"physics_kill_y")){danger=true;break;}
        if(!t.player.ball.is_moving&&!t.player.ball.capture_until)break;
    }
    t.time=w.time;t.safe=t.player.ball.is_in_hole||(!danger&&!t.player.ball.is_in_water&&!t.player.ball.is_moving&&!t.player.ball.capture_until);
    t.cost=t.player.ball.is_in_hole?-10000:route_cost(nav,t.player.ball.pos)+(t.safe?0:1500)+power*.05f+(water_ticks?2.5f+water_ticks/120.f:0);
    if(vec3_distance(t.player.ball.pos,p->ball.pos)<.25f&&!t.player.ball.is_in_hole)t.cost+=3;
    return t;
}
static float repeated(const golf_bot_memory_t *memory,const golf_player_t *p,vec3 direction,float power){
    if(!memory)return 0;float penalty=0;
    for(int i=0;i<memory->count;i++){
        const golf_bot_attempt_t *a=&memory->attempts[i];
        if(a->failed&&vec3_distance(p->ball.pos,a->start)<.9f&&vec3_dot(a->direction,direction)>.995f&&fabsf(power-a->power)<.07f)penalty+=5;
    }return penalty;
}
golf_bot_plan_t golf_bot_plan_adaptive(golf_physics_world_t *world,const golf_mechanics_t *m,const golf_navigation_t *nav,const golf_player_t *p,int difficulty,const golf_bot_memory_t *memory){
    difficulty=difficulty<0?0:difficulty>3?3:difficulty;build_route(world,m,nav);nav=&route.navigation;
    float speed=0,unused;vec3 aim=target(nav,p->ball.pos,2.2f,&speed),far=target(nav,p->ball.pos,4.8f,&unused),delta=vec3_sub(aim,p->ball.pos);
    float heading=atan2f(delta.x,delta.z),far_heading=atan2f(far.x-p->ball.pos.x,far.z-p->ball.pos.z),hole_heading=atan2f(m->hole.x-p->ball.pos.x,m->hole.z-p->ball.pos.z);
    float base=power_for_speed(world,speed>0?speed:sqrtf(5.88f*horizontal(aim,p->ball.pos)+19.6f*fmaxf(0,aim.y-p->ball.pos.y)));
    float angles[]={heading,heading+.20f,heading-.20f,far_heading,heading+MF_PI/4,heading-MF_PI/4,hole_heading,heading+MF_PI/2,heading-MF_PI/2,heading+MF_PI,heading+.10f,heading-.10f};
    float powers[]={0,.045f,.09f,.16f,.24f,.36f,.52f,.72f,.90f,1,base,golf_clampf(base*1.15f+.015f,0,1)};
    const int counts[]={24,48,96,144},horizons[]={960,1200,1440,1440};
    if(memory&&memory->stalled>1){angles[1]=heading+.45f;angles[2]=heading-.45f;angles[3]=heading+MF_PI;}
    golf_bot_plan_t plan={.direction=V3(sinf(heading),0,cosf(heading)),.power=base};float best=FLT_MAX,initial_cost=route_cost(nav,p->ball.pos);
    golf_bvh_t dynamic;golf_bvh_init(&dynamic);
    trial_t beams[4];golf_bot_plan_t first[4];int beam_count=0;
    for(int candidate=0;candidate<counts[difficulty];candidate++){
        float angle=angles[candidate/12],power=powers[candidate%12];vec3 direction=V3(sinf(angle),0,cosf(angle));
        trial_t t=simulate(world,&dynamic,m,nav,p,direction,power,horizons[difficulty]);plan.candidates++;
        float score=t.cost+repeated(memory,p,direction,power);
        if(score<best){best=score;plan.direction=direction;plan.power=power;plan.landing=t.player.ball.pos;plan.safe=t.safe;plan.peak=t.peak;plan.launch_speed=speed;}
        if(t.safe&&difficulty>=2){
            bool available=beam_count<4;int at=available?beam_count++:3;
            if(available||t.cost<beams[3].cost){
                beams[at]=t;first[at]=(golf_bot_plan_t){.direction=direction,.power=power,.landing=t.player.ball.pos,.safe=true,.peak=t.peak,.launch_speed=speed};
                for(int j=at;j>0&&beams[j].cost<beams[j-1].cost;j--){trial_t swap=beams[j];beams[j]=beams[j-1];beams[j-1]=swap;golf_bot_plan_t f=first[j];first[j]=first[j-1];first[j-1]=f;}
            }
        }
        if(t.player.ball.is_in_hole)break;
        if(difficulty==2&&candidate>=47&&speed==0&&(!memory||!memory->stalled)&&best<initial_cost-1.5f)break;
    }
    /* A bounded second ply resolves staged ramp approaches and obstructed exits. */
    if(difficulty>=2&&best>-9999&&(speed>0||(memory&&memory->stalled)||difficulty==3)){
        int width=difficulty==3?beam_count:(beam_count<2?beam_count:2);
        for(int i=0;i<width;i++){
            float launch;vec3 q=target(nav,beams[i].player.ball.pos,3.3f,&launch),d=vec3_sub(q,beams[i].player.ball.pos);float length=horizontal(q,beams[i].player.ball.pos);
            float power=power_for_speed(world,launch>0?launch:sqrtf(5.88f*length+19.6f*fmaxf(0,d.y)));
            for(int k=0;k<(difficulty==3?6:3);k++){
                float a=atan2f(d.x,d.z)+(k>=3?(k%2?.13f:-.13f):0),scale=k%3==0?.85f:k%3==1?1:1.2f;
                golf_physics_world_t w=*world;w.time=beams[i].time;
                trial_t t=simulate(&w,&dynamic,&beams[i].mechanics,nav,&beams[i].player,V3(sinf(a),0,cosf(a)),golf_clampf(power*scale,0,1),1440);plan.lookahead++;
                float score=t.cost+2.7f+repeated(memory,p,first[i].direction,first[i].power);
                if(t.safe&&score<best){int candidates=plan.candidates,lookahead=plan.lookahead;plan=first[i];plan.candidates=candidates;plan.lookahead=lookahead;best=score;}
            }
        }
    }
    vec_deinit(&dynamic.faces);vec_deinit(&dynamic.node_infos);vec_deinit(&dynamic.nodes);
    uint32_t seed=hash(m->seed^p->id^(p->stroke_count*0x9e3779b9u));
    const float errors[]={.10f,.035f,.004f,0},force_errors[]={.06f,.02f,.003f,0};
    float adapt=memory&&memory->stalled>1?.35f:1;
    float angle=atan2f(plan.direction.x,plan.direction.z)+((seed&65535)/32767.5f-1)*errors[difficulty]*adapt;
    plan.direction=V3(sinf(angle),0,cosf(angle));plan.power=golf_clampf(plan.power+((seed>>16)/32767.5f-1)*force_errors[difficulty]*adapt,0,1);
    return plan;
}
golf_bot_plan_t golf_bot_plan(golf_physics_world_t *world,const golf_mechanics_t *m,const golf_navigation_t *nav,const golf_player_t *p,int difficulty){return golf_bot_plan_adaptive(world,m,nav,p,difficulty,NULL);}
