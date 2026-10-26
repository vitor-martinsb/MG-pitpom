#include "golf/game.h"
#include "golf/golf.h"
#include "golf/garden.h"
#include "golf/draw.h"
#include "common/graphics.h"
#include <stdio.h>
#include <float.h>
#include <string.h>
#ifdef GOLF_PLATFORM_EMSCRIPTEN
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

/* A cached static projection and a small 10 Hz read-only HUD frame. */
EMSCRIPTEN_KEEPALIVE const char *golf_course_geometry(void) {
    static char text[524288];
    golf_game_t *g=golf_game_get();golf_mechanics_t *m=&g->mechanics;
    int used=snprintf(text,sizeof(text),"{\"bounds\":[%.5g,%.5g,%.5g,%.5g],\"start\":[%.5g,%.5g],\"hole\":[%.5g,%.5g],\"triangles\":[",m->bounds_min.x,m->bounds_min.z,m->bounds_max.x,m->bounds_max.z,m->start.x,m->start.z,m->hole.x,m->hole.z);
    int count=0;
    for(int i=0;i<g->physics.static_bvh.faces.length && count<4096;i++) {
        golf_bvh_face_t *f=&g->physics.static_bvh.faces.data[i];
        if(!f->entity || (f->entity->type!=GEO_ENTITY&&f->entity->type!=MODEL_ENTITY&&f->entity->type!=WATER_ENTITY))continue;
        if(f->entity->type==MODEL_ENTITY&&(strstr(f->entity->model.model_path,"/tree_")||strstr(f->entity->model.model_path,"/platform_")))continue;
        vec3 n=vec3_normalize(vec3_cross(vec3_sub(f->b,f->a),vec3_sub(f->c,f->a)));
        int kind=f->entity->type==WATER_ENTITY?3:f->entity->type==MODEL_ENTITY?2:n.y>.6f?0:1;
        int length=snprintf(text+used,sizeof(text)-(size_t)used,"%s[%.5g,%.5g,%.5g,%.5g,%.5g,%.5g,%d]",count?",":"",f->a.x,f->a.z,f->b.x,f->b.z,f->c.x,f->c.z,kind);
        if(length<0||(size_t)length>=sizeof(text)-(size_t)used-8)break;used+=length;count++;
    }
    snprintf(text+used,sizeof(text)-(size_t)used,"]}");return text;
}
EMSCRIPTEN_KEEPALIVE const char *golf_course_frame(void) {
    static char text[32768];golf_game_t *g=golf_game_get();golf_t *golf=golf_get();
    golf_mechanics_t *m=&g->mechanics;golf_graphics_t *graphics=golf_graphics_get();
    bool active=golf->state==GOLF_STATE_IN_GAME&&g->state!=GOLF_GAME_STATE_PAUSED;
    int used=snprintf(text,sizeof(text),"{\"active\":%s,\"level\":%d,\"intro\":%s,\"progress\":%.5g,\"time\":%.5g,\"mode\":\"%s\",\"local\":%u,\"camera\":[%.5g,%.5g,%.5g],\"cat\":[%.5g,%.5g],\"dog\":[%.5g,%.5g],\"slapTime\":%.5g,\"wakeTime\":%.5g,\"players\":[",active?"true":"false",golf->level_num,g->begin_camera_animation.active?"true":"false",g->begin_camera_animation.t/7.5f,g->t,m->impact?"impact":"classic",g->local_player_id,graphics->cam_pos.x,graphics->cam_pos.y,graphics->cam_pos.z,m->cat.x,m->cat.z,m->dog.x,m->dog.z,m->cat_slap_time,m->dog_wake_time);
    for(int i=0;i<g->player_count;i++) {
        golf_player_t *p=&g->players[i];
        int n=snprintf(text+used,sizeof(text)-(size_t)used,"%s{\"id\":%u,\"pos\":[%.5g,%.5g],\"color\":[%.4g,%.4g,%.4g],\"visible\":%s,\"captured\":%s,\"firstComplete\":%s,\"strokes\":%d,\"slowShots\":%d,\"slowUntil\":%.5g,\"mudShots\":%d,\"mudFadeUntil\":%.5g,\"captureKind\":%d,\"effectKind\":%d,\"effectTime\":%.5g,\"effectSerial\":%u}",i?",":"",p->id,p->ball.draw_pos.x,p->ball.draw_pos.z,p->color.x,p->color.y,p->color.z,golf_game_player_visible(p)?"true":"false",p->ball.captured?"true":"false",p->ball.first_shot_complete?"true":"false",p->stroke_count,p->ball.slow_shots,p->ball.slow_until,p->ball.mud_shots,p->ball.mud_fade_until,p->ball.capture_kind,p->ball.effect_kind,p->ball.effect_time,p->ball.effect_serial);
        if(n<0||(size_t)n>=sizeof(text)-(size_t)used-8)break;used+=n;
    }
    used+=snprintf(text+used,sizeof(text)-(size_t)used,"],\"world\":%d,\"stage\":%d,\"course\":%d,\"wildlife\":[",m->wildlife.world,m->wildlife.stage,m->wildlife.course);
    for(int i=0;i<GOLF_WILDLIFE_COUNT;i++) {
        golf_wild_animal_t *a=&m->wildlife.animals[i];
        used+=snprintf(text+used,sizeof(text)-(size_t)used,"%s{\"kind\":%d,\"active\":%s,\"visible\":%s,\"presence\":%.5g,\"pos\":[%.5g,%.5g,%.5g],\"walking\":%s,\"stride\":%.5g,\"gait\":%.5g,\"speed\":%.5g,\"actionTime\":%.5g,\"action\":%d}",i?",":"",i,(a->active&&i==m->third_kind)?"true":"false",(a->active&&a->present)?"true":"false",a->presence,a->pos.x,a->pos.y,a->pos.z,a->walking?"true":"false",a->stride,a->gait,a->speed,a->action_time,a->action);
    }
    used+=snprintf(text+used,sizeof(text)-(size_t)used,"],\"wind\":[");
    for(int i=0;i<m->wildlife.wind_count;i++){
        golf_wind_zone_t *z=&m->wildlife.wind[i];
        used+=snprintf(text+used,sizeof(text)-(size_t)used,"%s{\"mill\":%s,\"pos\":[%.5g,%.5g,%.5g],\"direction\":[%.5g,%.5g],\"strength\":%.5g,\"period\":%.5g,\"gust\":%.5g}",i?",":"",z->mill?"true":"false",z->pos.x,z->pos.y,z->pos.z,z->direction.x,z->direction.z,z->strength,z->period,golf_wind_gust(z,g->t));
    }
    used+=snprintf(text+used,sizeof(text)-(size_t)used,"],\"acceptedShots\":%u,\"puddles\":[",m->wildlife.accepted_shots);
    int puddles=0;for(int i=0;i<GOLF_PUDDLES;i++)if(m->wildlife.puddles[i].active){
        golf_puddle_t *p=&m->wildlife.puddles[i];used+=snprintf(text+used,sizeof(text)-(size_t)used,"%s{\"id\":%u,\"pos\":[%.5g,%.5g,%.5g],\"remaining\":%d}",puddles++?",":"",p->id,p->pos.x,p->pos.y,p->pos.z,p->remaining);
    }
    used+=snprintf(text+used,sizeof(text)-(size_t)used,"],\"mudPrints\":[");
    int prints=0;for(int i=0;i<GOLF_MUD_PRINTS;i++)if(m->wildlife.mud_prints[i].active){
        golf_mud_print_t *p=&m->wildlife.mud_prints[i];used+=snprintf(text+used,sizeof(text)-(size_t)used,"%s{\"id\":%u,\"pos\":[%.5g,%.5g,%.5g],\"born\":%.5g}",prints++?",":"",p->id,p->pos.x,p->pos.y,p->pos.z,p->born);
    }
    vec3 flag=golf_garden_flag_point(.8f,1,golf_garden_flag_time());
    used+=snprintf(text+used,sizeof(text)-(size_t)used,"],\"surfaceGroups\":%u,\"landscapeGap\":%.5g",golf_draw_surface_groups(),golf_garden_landscape_gap());
    used+=snprintf(text+used,sizeof(text)-(size_t)used,",\"catActive\":%s,\"dogActive\":%s,\"catVisible\":%s,\"dogVisible\":%s,\"thirdKind\":%d,\"catPresence\":%.5g,\"dogPresence\":%.5g,\"catPhase\":%.5g,\"actorVertices\":%u,\"flagPoint\":[%.5g,%.5g,%.5g],\"obstacles\":[",m->cat_valid?"true":"false",m->dog_valid?"true":"false",m->cat_present?"true":"false",m->dog_present?"true":"false",m->third_kind,m->cat_presence,m->dog_presence,m->cat_phase,golf_garden_actor_vertex_count(),flag.x,flag.y,flag.z);
    for(int i=0;i<g->physics.dynamic_bvh.node_infos.length&&i<32;i++) {
        golf_bvh_aabb_t a=g->physics.dynamic_bvh.node_infos.data[i].aabb;
        used+=snprintf(text+used,sizeof(text)-(size_t)used,"%s[%.5g,%.5g,%.5g,%.5g]",i?",":"",a.min.x,a.min.z,a.max.x,a.max.z);
    }
    snprintf(text+used,sizeof(text)-(size_t)used,"]}");return text;
}
EMSCRIPTEN_KEEPALIVE void golf_course_skip(void) {golf_game_skip_presentation();}
