#include "golf/online.h"
#include "golf/game.h"
#include "golf/golf.h"
#include "common/data.h"
#include "common/json.h"
#include "common/audio.h"
#include "common/graphics.h"
#include "common/inputs.h"
#include "parson/parson.h"
#include <string.h>
#include <stdio.h>
#include <float.h>

#ifdef GOLF_PLATFORM_EMSCRIPTEN
#include <emscripten.h>
EM_JS(void, online_ready, (int hole), { if (window.GolfOnline) window.GolfOnline.ready(hole); });
EM_JS(void, online_send_shot, (float x, float z, float power), { if (window.GolfOnline) window.GolfOnline.shot([x,0,z],power); });
EM_JS(int, online_blocked, (), { return window.GolfOnline && window.GolfOnline.blocked() ? 1 : 0; });
EM_JS(void, online_preview, (), { if(window.GolfOnline)window.GolfOnline.preview(); });
#else
static void online_ready(int hole) { (void)hole; }
static void online_send_shot(float x, float z, float power) { (void)x; (void)z; (void)power; }
static int online_blocked(void) { return 0; }
static void online_preview(void) {}
#define EMSCRIPTEN_KEEPALIVE
#endif

static struct {
    bool active, playing, shot_pending, loading, has_snapshot, awaiting_ready, impact;
    int requested_level, hole;
    uint32_t local_id, camera_id;
    float age, interval, time;
    vec3 from[GOLF_MAX_PLAYERS], target[GOLF_MAX_PLAYERS];
} online;

/* Read-only diagnostics for integration tests and the browser console. */
EMSCRIPTEN_KEEPALIVE const char *golf_online_diagnostics(void) {
    static char buffer[16384];
    golf_game_t *game=golf_game_get();
    golf_player_t *local=golf_game_get_local_player();
    vec2 screen=golf_graphics_world_to_screen(local->ball.draw_pos);
    int used=snprintf(buffer,sizeof(buffer),"{\"active\":%s,\"state\":%d,\"local\":%u,\"touch\":%s,\"cameraAngle\":%.9g,\"aimPower\":%.9g,\"aimArrows\":%d,\"screen\":[%.9g,%.9g],\"players\":[",online.active?"true":"false",game->state,game->local_player_id,golf_inputs_get()->is_touch?"true":"false",game->cam.angle,game->aim_line.power,game->aim_line.num_arrows,screen.x,screen.y);
    for(int i=0;i<game->player_count;i++) {
        golf_player_t *p=&game->players[i];
        int n=snprintf(buffer+used,sizeof(buffer)-(size_t)used,"%s[%u,%d,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g]",i?",":"",p->id,p->connected,p->ball.pos.x,p->ball.pos.y,p->ball.pos.z,p->ball.draw_pos.x,p->ball.draw_pos.y,p->ball.draw_pos.z,p->color.x,p->color.y,p->color.z);
        if(n<0 || (size_t)n>=sizeof(buffer)-(size_t)used)break;
        used+=n;
    }
    snprintf(buffer+used,sizeof(buffer)-(size_t)used,"]}");
    return buffer;
}

bool golf_online_active(void) { return online.active; }
bool golf_online_input_blocked(void) { return online_blocked()!=0; }
bool golf_online_can_shoot(void) {
    golf_player_t *p=golf_game_get_local_player();
    return online.active && online.playing && !online.loading && !golf_game_get()->begin_camera_animation.active && !online.shot_pending && online.has_snapshot && p->connected && !p->ball.is_moving && !p->ball.is_in_hole && !p->ball.capture_until;
}
golf_player_t *golf_online_camera_player(void) {
    golf_player_t *p=golf_game_get_player(online.camera_id);
    if (p && p->connected) return p;
    return golf_game_get_local_player();
}
bool golf_online_shoot(vec3 direction, float power) {
    if (!golf_online_can_shoot()) return false;
    online.shot_pending=true;
    golf_game_get()->state=GOLF_GAME_STATE_WATCHING_BALL;
    online_send_shot(direction.x,direction.z,golf_clampf(power,0,1));
    return true;
}

/* Only the trusted WebSocket bridge calls this; server snapshots own ball state. */
EMSCRIPTEN_KEEPALIVE void golf_online_receive(const char *json) {
    JSON_Value *value=json_parse_string(json); JSON_Object *o=json_value_get_object(value);
    const char *type=json_object_get_string(o,"type");
    golf_game_t *game=golf_game_get();
    if (!type) {json_value_free(value);return;}
    if (!strcmp(type,"welcome")) {
        online.active=true; online.local_id=(uint32_t)json_object_get_number(o,"id");
        online.camera_id=online.local_id; online.requested_level=-1;
        game->local_player_id=online.local_id; game->players[0].id=online.local_id;
        game->debug_test_players=false;
    } else if (!strcmp(type,"room") && online.active) {
        const char *mode=json_object_get_string(o,"mode");online.impact=mode&&!strcmp(mode,"impact");game->mechanics.impact=online.impact;
        const char *phase=json_object_get_string(o,"phase"); online.playing=phase && !strcmp(phase,"playing");
        JSON_Array *members=json_object_get_array(o,"players");
        golf_player_t previous[GOLF_MAX_PLAYERS]; memcpy(previous,game->players,sizeof(previous)); int old_count=game->player_count;
        int count=(int)json_array_get_count(members); if(count>GOLF_MAX_PLAYERS) count=GOLF_MAX_PLAYERS;
        /* Put the local player first without changing identity IDs. */
        game->player_count=0;
        for(int pass=0;pass<2;pass++) for(int i=0;i<count;i++) {
            JSON_Object *m=json_array_get_object(members,i); uint32_t id=(uint32_t)json_object_get_number(m,"id");
            if ((id==online.local_id)!=(pass==0)) continue;
            golf_player_t *p=&game->players[game->player_count++]; memset(p,0,sizeof(*p));
            for(int j=0;j<old_count;j++) if(previous[j].id==id) {*p=previous[j];break;}
            const char *name=json_object_get_string(m,"nickname"), *color=json_object_get_string(m,"color"); unsigned rgb=0xffffff;
            if(color) sscanf(color,"#%x",&rgb);
            if(!p->id) golf_player_init(p,id,name?name:"Player",V4(1,1,1,1),(uint32_t)json_object_get_number(m,"avatar"));
            snprintf(p->name,sizeof(p->name),"%s",name?name:"Player"); p->color=V4(((rgb>>16)&255)/255.f,((rgb>>8)&255)/255.f,(rgb&255)/255.f,1);
            p->connected=json_object_get_boolean(m,"connected")==1;
        }
    } else if (!strcmp(type,"load") && online.active) {
        online.requested_level=(int)json_object_get_number(o,"level"); online.hole=(int)json_object_get_number(o,"hole");
        online.loading=true; online.has_snapshot=false; online.shot_pending=false;
        online.awaiting_ready=false;
    } else if (!strcmp(type,"snapshot") && online.active && (int)json_object_get_number(o,"hole")==online.hole) {
        float time=(float)json_object_get_number(o,"time");
        online.interval=golf_clampf(time-online.time,1.f/30,0.2f); online.time=time; online.age=0;
        /* Empty deltas must not restart interpolation from an older position. */
        for(int i=0;i<game->player_count;i++) {
            online.from[i]=game->players[i].ball.draw_pos;
            online.target[i]=game->players[i].ball.pos;
        }
        JSON_Array *balls=json_object_get_array(o,"players");
        JSON_Object *mascots=json_object_get_object(o,"mascots");
        if(mascots){game->mechanics.enabled=json_object_get_boolean(mascots,"enabled")==1;
            game->mechanics.cat_valid=json_object_has_value(mascots,"catActive")?json_object_get_boolean(mascots,"catActive")==1:true;
            game->mechanics.dog_valid=json_object_has_value(mascots,"dogActive")?json_object_get_boolean(mascots,"dogActive")==1:true;
            game->mechanics.cat=golf_json_object_get_vec3(mascots,"cat");game->mechanics.dog=golf_json_object_get_vec3(mascots,"dog");
            game->mechanics.cat_slap_time=(float)json_object_get_number(mascots,"slapTime");game->mechanics.dog_wake_time=(float)json_object_get_number(mascots,"wakeTime");
            JSON_Array *animals=json_object_get_array(mascots,"wildlife");
            for(int k=0;k<3;k++) {
                golf_wild_animal_t *a=&game->mechanics.wildlife.animals[k];
                JSON_Object *o=json_array_get_object(animals,k);a->active=o&&json_object_get_boolean(o,"active")==1;
                if(a->active){a->pos=golf_json_object_get_vec3(o,"pos");a->forward=golf_json_object_get_vec3(o,"forward");a->walking=json_object_get_boolean(o,"walking")==1;a->clock=(float)json_object_get_number(o,"clock");a->action=(int)json_object_get_number(o,"action");a->action_time=(float)json_object_get_number(o,"actionTime");}
            }
        }
        for(size_t i=0;i<json_array_get_count(balls);i++) {
            JSON_Object *b=json_array_get_object(balls,i); golf_player_t *p=golf_game_get_player((uint32_t)json_object_get_number(b,"id")); if(!p)continue;
            int index=(int)(p-game->players);
            vec3 pos=golf_json_object_get_vec3(b,"pos");
            if (!online.has_snapshot || vec3_distance(p->ball.draw_pos,pos)>3) p->ball.draw_pos=pos;
            online.from[index]=p->ball.draw_pos; online.target[index]=pos;
            bool was_hole=p->ball.is_in_hole;
            bool was_capturing=p->ball.capture_until>0;
            p->ball.pos=pos; p->ball.vel=golf_json_object_get_vec3(b,"vel"); p->ball.is_moving=json_object_get_boolean(b,"moving")==1;
            p->ball.is_in_hole=json_object_get_boolean(b,"hole")==1; p->ball.is_in_water=json_object_get_boolean(b,"water")==1;
            p->stroke_count=(int)json_object_get_number(b,"strokes");
            p->ball.first_shot_complete=json_object_get_boolean(b,"firstComplete")==1;
            p->ball.captured=json_object_get_boolean(b,"captured")==1;
            p->ball.capture_until=(float)json_object_get_number(b,"captureUntil");
            p->ball.slow_until=(float)json_object_get_number(b,"slowUntil");
            p->ball.capture_kind=(int)json_object_get_number(b,"captureKind");
            p->ball.effect_kind=(int)json_object_get_number(b,"effectKind");
            p->ball.effect_time=(float)json_object_get_number(b,"effectTime");
            p->ball.effect_serial=(uint32_t)json_object_get_number(b,"effectSerial");
            p->ball.wildlife_protection=(float)json_object_get_number(b,"wildlifeProtection");
            if(was_capturing&&!p->ball.capture_until){
                p->ball.orientation=QUAT(0,0,0,1);p->ball.rot_vel=0;p->ball.rot_vec=V3(0,0,0);
                p->ball.draw_pos=pos;online.from[index]=online.target[index]=pos;
            }
            if(p->id==online.local_id && !was_hole && p->ball.is_in_hole) golf_audio_start_sound("ball_in_hole","data/audio/confirmation_002.ogg",1,false,true);
        }
        online.has_snapshot=true;
    } else if (!strcmp(type,"shot")) {
        online.shot_pending=false;
        golf_game_get_local_player()->ball.is_moving=true;
        golf_audio_start_sound("hit_ball","data/audio/impactPlank_medium_000.ogg",1,false,true);
    } else if (!strcmp(type,"skip-presentation")) { golf_game_skip_presentation();
    } else if (!strcmp(type,"cancel-aim")) {
        if (game->state==GOLF_GAME_STATE_AIMING) game->state=GOLF_GAME_STATE_WAITING_FOR_AIM;
        game->aim_line.power=0;
    } else if (!strcmp(type,"error")) { online.shot_pending=false;
    } else if (!strcmp(type,"spectate")) {
        golf_player_t *local=golf_game_get_local_player();
        if(local->ball.is_in_hole || !online.playing) online.camera_id=(uint32_t)json_object_get_number(o,"id");
    } else if (!strcmp(type,"disconnected")) { online.playing=false; online.shot_pending=false;
    } else if (!strcmp(type,"leave")) {
        online.active=false; online.playing=false;
        game->begin_camera_animation.active=false;
        golf_player_t local=*golf_game_get_local_player(); game->players[0]=local; game->player_count=1;
        if(golf_get()->level) golf_goto_main_menu();
    }
    json_value_free(value);
}

void golf_online_update(float dt) {
    if(!online.active) return;
    golf_t *golf=golf_get(); golf_game_t *game=golf_game_get();
    if(online.requested_level>=0 && golf->state!=GOLF_STATE_TITLE_SCREEN && golf_data_get_load_state(golf->level_loading_path)==GOLF_DATA_LOADED) {
        int level=online.requested_level; online.requested_level=-1; golf_start_level(level);
    }
    if(online.loading && online.requested_level<0 && golf->state==GOLF_STATE_IN_GAME) {
        online.loading=false; online.camera_id=online.local_id;
        game->mechanics.impact=online.impact;
        for(int i=0;i<game->player_count;i++) {
            golf_player_start_level(&game->players[i],game->ball_start_pos);
            online.from[i]=online.target[i]=game->ball_start_pos;
        }
        online.has_snapshot=false;online.awaiting_ready=true;online_preview();
    }
    if(online.awaiting_ready&&!game->begin_camera_animation.active){online.awaiting_ready=false;online_ready(online.hole);}
    if(golf->state!=GOLF_STATE_IN_GAME || online.loading) return;
    online.age+=dt;
    float alpha=golf_clampf(online.age/online.interval,0,1);
    if(online.has_snapshot) for(int i=0;i<game->player_count;i++) {
        golf_player_t *p=&game->players[i];
        p->ball.draw_pos=vec3_add(vec3_scale(online.from[i],1-alpha),vec3_scale(online.target[i],alpha));
        if(p->ball.is_moving) {
            vec3 axis=vec3_cross(V3(0,1,0),p->ball.vel);
            if(vec3_length(axis)>.001f) p->ball.orientation=quat_multiply(quat_create_from_axis_angle(vec3_normalize(axis),vec3_length(p->ball.vel)*dt/p->ball.radius),p->ball.orientation);
        }
        if(p->ball.is_in_water && p->connected) {
            p->ball.time_since_water_ripple+=dt;
            if(p->ball.time_since_water_ripple>.1f) {
                p->ball.time_since_water_ripple=0;
                for(int j=0;j<MAX_NUM_WATER_RIPPLES;j++) if(game->water_ripples[j].t0==FLT_MAX) {
                    game->water_ripples[j].t0=game->t; game->water_ripples[j].pos=vec3_add(p->ball.draw_pos,V3(0,-p->ball.radius+.02f,0)); break;
                }
            }
        }
    }
    game->t=online.time+golf_clampf(online.age,0,online.interval);
    if(!game->begin_camera_animation.active&&(game->state!=GOLF_GAME_STATE_AIMING || !golf_online_can_shoot())) game->state=golf_online_can_shoot()?GOLF_GAME_STATE_WAITING_FOR_AIM:GOLF_GAME_STATE_WATCHING_BALL;
}
