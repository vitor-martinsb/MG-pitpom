#include "golf/navigation.h"
#include <float.h>
#include <math.h>
#include <string.h>
static const int dx[]={-1,0,1,-1,1,-1,0,1},dz[]={-1,-1,-1,0,0,1,1,1};
static bool ground(const golf_bvh_face_t *f) {
    if(!f->entity||f->vel_scale<=.1f||f->entity->type==WATER_ENTITY)return false;
    if(f->entity->parent_idx>=0||(f->entity->type==GEO_ENTITY&&f->entity->geo.geo.is_water))return false;
    if(f->entity->type==MODEL_ENTITY&&strstr(f->entity->model.model_path,"/platform_"))return false;
    if(f->entity->type==GEO_ENTITY&&!strcmp(f->entity->name,"quiet-tunnel"))return false;
    if(f->entity->type==GEO_ENTITY&&!strcmp(f->entity->name,"campaign-fairway")&&f->vel_scale<.999f)return false;
    vec3 n=vec3_normalize(vec3_cross(vec3_sub(f->b,f->a),vec3_sub(f->c,f->a)));
    return n.y>.65f;
}
bool golf_nav_floor(golf_bvh_t *bvh,vec3 p,vec3 *floor,float clearance) {
    float t;int idx;golf_bvh_face_t f;vec3 origin=vec3_add(p,V3(0,2,0));bool found=false;
    /* A tunnel's roof is solid, but is not the floor for the passage below it. */
    for(int layer=0;layer<8;layer++) {
        t=FLT_MAX;if(!golf_bvh_ray_test(bvh,origin,V3(0,-1,0),&t,&idx,&f))return false;
        vec3 hit=vec3_add(origin,V3(0,-t,0));
        if(f.entity&&f.entity->type==GEO_ENTITY&&!strcmp(f.entity->name,"quiet-tunnel")){origin=vec3_sub(hit,V3(0,.01f,0));continue;}
        if(!ground(&f))return false;*floor=hit;found=true;break;
    }
    if(!found)return false;
    if(clearance>0){
        golf_ball_contact_t contacts[16];int count=0;
        golf_bvh_ball_test(bvh,vec3_add(*floor,V3(0,clearance+.03f,0)),clearance,V3(0,0,0),contacts,&count,16);
        for(int i=0;i<count;i++)if(contacts[i].is_water||contacts[i].is_out_of_bounds||fabsf(contacts[i].normal.y)<.65f)return false;
        for(int i=0;i<8;i++){
            float a=i*MF_PI/4;vec3 q=vec3_add(*floor,V3(cosf(a)*clearance,0,sinf(a)*clearance)),hit;
            if(!golf_nav_floor(bvh,q,&hit,0)||fabsf(hit.y-floor->y)>.18f)return false;
        }
    }
    return true;
}
bool golf_nav_segment(golf_bvh_t *bvh,vec3 a,vec3 b,float clearance) {
    int steps=(int)ceilf(vec3_distance(a,b)/.25f);if(steps<1)steps=1;
    for(int i=0;i<=steps;i++){
        float t=i/(float)steps;vec3 wanted=vec3_add(a,vec3_scale(vec3_sub(b,a),t)),floor;
        if(!golf_nav_floor(bvh,wanted,&floor,0)||fabsf(floor.y-wanted.y)>.20f)return false;
        golf_ball_contact_t contacts[8];int count=0;
        golf_bvh_ball_test(bvh,vec3_add(floor,V3(0,clearance+.03f,0)),clearance,V3(0,0,0),contacts,&count,8);
        for(int c=0;c<count;c++)if(fabsf(contacts[c].normal.y)<.65f||contacts[c].is_water||contacts[c].is_out_of_bounds)return false;
    }
    return true;
}
static int nearest(const golf_navigation_t *nav,vec3 p,bool reachable) {
    int best=-1;float distance=FLT_MAX;
    for(int i=0;i<nav->count;i++)if(!reachable||nav->nodes[i].reachable){float d=vec3_distance(p,nav->nodes[i].pos);if(d<distance){distance=d;best=i;}}
    return best;
}
void golf_nav_build(golf_navigation_t *nav,golf_bvh_t *bvh,vec3 start,vec3 hole) {
    memset(nav,0,sizeof(*nav));memset(nav->cells,-1,sizeof(nav->cells));nav->hole=hole;
    nav->floor=bvh;
    nav->min=V3(FLT_MAX,FLT_MAX,FLT_MAX);nav->max=V3(-FLT_MAX,-FLT_MAX,-FLT_MAX);
    for(int i=0;i<bvh->faces.length;i++)if(ground(&bvh->faces.data[i])){
        golf_bvh_face_t *f=&bvh->faces.data[i];vec3 v[]={f->a,f->b,f->c};
        if(f->entity->type==GEO_ENTITY&&!strcmp(f->entity->name,"campaign-fairway"))nav->campaign=true;
        for(int j=0;j<3;j++){nav->min=V3(fminf(nav->min.x,v[j].x),fminf(nav->min.y,v[j].y),fminf(nav->min.z,v[j].z));nav->max=V3(fmaxf(nav->max.x,v[j].x),fmaxf(nav->max.y,v[j].y),fmaxf(nav->max.z,v[j].z));}
    }
    if(nav->min.x==FLT_MAX)return;
    float w=nav->max.x-nav->min.x,h=nav->max.z-nav->min.z;
    nav->step=fmaxf(.55f,fmaxf(fmaxf(w,h)/120,sqrtf(w*h/3600)));
    nav->width=(int)(w/nav->step)+1;nav->height=(int)(h/nav->step)+1;
    for(int z=0;z<nav->height;z++)for(int x=0;x<nav->width;x++){
        vec3 p=V3(nav->min.x+(x+.5f)*nav->step,nav->max.y+.1f,nav->min.z+(z+.5f)*nav->step),floor;
        if(nav->count<GOLF_NAV_NODES&&golf_nav_floor(bvh,p,&floor,.14f)){
            nav->cells[z*nav->width+x]=(short)nav->count;nav->nodes[nav->count++]=(golf_nav_node_t){.pos=floor,.cost=FLT_MAX,.cell=z*nav->width+x};
        }
    }
    for(int z=0;z<nav->height;z++)for(int x=0;x<nav->width;x++){
        int i=nav->cells[z*nav->width+x];if(i<0)continue;
        for(int k=0;k<4;k++){
            int nx=x+dx[k],nz=z+dz[k];if(nx<0||nz<0||nx>=nav->width||nz>=nav->height)continue;
            int j=nav->cells[nz*nav->width+nx];
            if(j>=0&&fabsf(nav->nodes[i].pos.y-nav->nodes[j].pos.y)<.65f&&golf_nav_segment(bvh,nav->nodes[i].pos,nav->nodes[j].pos,.14f)){nav->nodes[i].edges|=1u<<k;nav->nodes[j].edges|=1u<<(7-k);}
        }
    }
    int queue[GOLF_NAV_NODES],read=0,used=0,first=nearest(nav,start,false);
    if(first<0)return;queue[used++]=first;nav->nodes[first].reachable=true;
    while(read<used){int i=queue[read++],cell=nav->nodes[i].cell;
        for(int k=0;k<8;k++)if(nav->nodes[i].edges&(1u<<k)){int j=nav->cells[cell+dz[k]*nav->width+dx[k]];if(!nav->nodes[j].reachable){nav->nodes[j].reachable=true;queue[used++]=j;}}
    }
    int goal=nearest(nav,hole,true);if(goal<0)return;nav->nodes[goal].cost=vec3_distance(nav->nodes[goal].pos,hole);
    bool visited[GOLF_NAV_NODES]={0};
    for(int iteration=0;iteration<used;iteration++){
        int best=-1;float cost=FLT_MAX;for(int i=0;i<nav->count;i++)if(!visited[i]&&nav->nodes[i].cost<cost){best=i;cost=nav->nodes[i].cost;}
        if(best<0)break;visited[best]=true;int cell=nav->nodes[best].cell;
        for(int k=0;k<8;k++)if(nav->nodes[best].edges&(1u<<k)){int j=nav->cells[cell+dz[k]*nav->width+dx[k]];float next=cost+vec3_distance(nav->nodes[best].pos,nav->nodes[j].pos);if(next<nav->nodes[j].cost)nav->nodes[j].cost=next;}
    }
}
float golf_nav_cost(const golf_navigation_t *nav,vec3 p) {
    int i=nearest(nav,p,true);if(i<0)return vec3_distance(p,nav->hole);
    return nav->nodes[i].cost+vec3_distance(p,nav->nodes[i].pos);
}
vec3 golf_nav_target(const golf_navigation_t *nav,vec3 p) {
    int i=nearest(nav,p,true);if(i<0)return nav->hole;
    vec3 target=nav->nodes[i].pos;float cost=nav->nodes[i].cost;
    for(int j=0;j<nav->count;j++)if(nav->nodes[j].reachable&&nav->nodes[j].cost<cost&&vec3_distance(p,nav->nodes[j].pos)<2.0f&&(!nav->campaign||golf_nav_segment(nav->floor,p,nav->nodes[j].pos,.14f))){target=nav->nodes[j].pos;cost=nav->nodes[j].cost;}
    return vec3_distance(p,nav->hole)<2&&(!nav->campaign||golf_nav_segment(nav->floor,p,nav->hole,.14f))?nav->hole:target;
}
