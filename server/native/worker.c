#include "golf/physics.h"
#include "golf/mechanics.h"
#include "bot.h"
#include "common/json.h"
#include "parson/parson.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <sys/resource.h>
#endif

void headless_config_load(void);
bool headless_level_load(golf_level_t *level, const char *path);
size_t headless_allocated_bytes(void);
static double cpu_ms(void) {
#ifdef _WIN32
    FILETIME created,exited,kernel,user;
    if(!GetProcessTimes(GetCurrentProcess(),&created,&exited,&kernel,&user))return 0;
    ULARGE_INTEGER k,u;k.LowPart=kernel.dwLowDateTime;k.HighPart=kernel.dwHighDateTime;u.LowPart=user.dwLowDateTime;u.HighPart=user.dwHighDateTime;
    return (k.QuadPart+u.QuadPart)/10000.0;
#else
    struct rusage usage;getrusage(RUSAGE_SELF,&usage);
    return (usage.ru_utime.tv_sec+usage.ru_stime.tv_sec)*1000.0+(usage.ru_utime.tv_usec+usage.ru_stime.tv_usec)/1000.0;
#endif
}
static size_t rss_bytes(void) {
#ifdef _WIN32
    PROCESS_MEMORY_COUNTERS counters={0};counters.cb=sizeof(counters);
    return GetProcessMemoryInfo(GetCurrentProcess(),&counters,sizeof(counters))?counters.WorkingSetSize:0;
#else
    struct rusage usage;getrusage(RUSAGE_SELF,&usage);
#ifdef __APPLE__
    return usage.ru_maxrss;
#else
    return usage.ru_maxrss*1024;
#endif
#endif
}

static golf_player_t players[GOLF_MAX_PLAYERS];
static golf_bot_memory_t bot_memory[GOLF_MAX_PLAYERS];
static golf_level_t level;
static golf_config_t config;
static golf_bvh_t static_bvh, dynamic_bvh;
static golf_physics_world_t world;
static vec3 spawn;
static golf_mechanics_t mechanics;
static const golf_navigation_t *navigation;

/* Internal transfer between two instances of this exact executable. No client
   accepts or supplies these bytes. Geometry stays local; pointers never cross
   the pipe, and the receiving planner binds its own immutable floor/navigation.
   Only the main worker can accept shots or advance the actual match. */
typedef struct planner_snapshot {
    unsigned version,level_id;
    float time;
    int slot,pending_stroke;
    golf_player_t player;
    golf_mechanics_t mechanics;
    golf_bot_attempt_t pending;
} planner_snapshot_t;
static unsigned level_id;
static bool planner_only;
static unsigned path_hash(const char *s){unsigned h=2166136261u;while(*s)h=(h^(unsigned char)*s++)*16777619u;return h;}
static void planner_snapshot_json(int request,int slot){
    golf_player_t *p=&players[slot];
    if(!p->id||!p->connected||p->ball.is_moving||p->ball.is_in_hole||p->ball.capture_until){printf("{\"request\":%d,\"ok\":false}\n",request);return;}
    planner_snapshot_t s={0};s.version=1;s.level_id=level_id;s.time=world.time;s.slot=slot;s.player=*p;s.mechanics=mechanics;
    s.mechanics.wildlife.floor=NULL;s.mechanics.wildlife.nav=NULL;
    s.pending=bot_memory[slot].pending;s.pending_stroke=bot_memory[slot].pending_stroke;
    const char hex[]="0123456789abcdef";char encoded[sizeof(s)*2+1];const unsigned char *bytes=(const unsigned char *)&s;
    for(size_t i=0;i<sizeof(s);i++){encoded[i*2]=hex[bytes[i]>>4];encoded[i*2+1]=hex[bytes[i]&15];}encoded[sizeof(s)*2]=0;
    printf("{\"request\":%d,\"ok\":true,\"time\":%.9g,\"state\":\"%s\"}\n",request,world.time,encoded);
}
static int unhex(char c){return c>='0'&&c<='9'?c-'0':c>='a'&&c<='f'?c-'a'+10:-1;}
static bool restore_planner(const char *encoded){
    planner_snapshot_t s;
    if(!encoded||strlen(encoded)!=sizeof(s)*2)return false;
    unsigned char *bytes=(unsigned char *)&s;
    for(size_t i=0;i<sizeof(s);i++){int a=unhex(encoded[i*2]),b=unhex(encoded[i*2+1]);if(a<0||b<0)return false;bytes[i]=(unsigned char)(a*16+b);}
    if(s.version!=1||s.level_id!=level_id||s.slot<0||s.slot>=GOLF_MAX_PLAYERS||!isfinite(s.time)||s.time<0||!s.player.id)return false;
    if(players[s.slot].id!=s.player.id||s.player.stroke_count<players[s.slot].stroke_count)memset(&bot_memory[s.slot],0,sizeof(bot_memory[s.slot]));
    players[s.slot]=s.player;mechanics=s.mechanics;world.time=s.time;
    mechanics.wildlife.floor=&static_bvh;mechanics.wildlife.nav=navigation;
    bot_memory[s.slot].pending=s.pending;bot_memory[s.slot].pending_stroke=s.pending_stroke;
    return true;
}
typedef struct sound_event{unsigned id,player;const char *kind;float strength;} sound_event_t;
static sound_event_t events[64];static unsigned event_id;static int event_count;static golf_player_t *sound_player;
static bool incidental(const char *kind){return !strcmp(kind,"wood")||!strcmp(kind,"stone")||!strcmp(kind,"impact");}
static void event(const char *kind,golf_player_t *p,float strength){
    if(incidental(kind))for(int i=0;i<event_count;i++)if(events[i].player==p->id&&!strcmp(events[i].kind,kind)){events[i].strength=fmaxf(events[i].strength,strength);return;}
    if(event_count==64){
        if(incidental(kind))return;
        int discard=-1;for(int i=0;i<event_count;i++)if(incidental(events[i].kind)){discard=i;break;}
        if(discard<0)return;memmove(events+discard,events+discard+1,(event_count-discard-1)*sizeof(*events));event_count--;
    }
    events[event_count++]=(sound_event_t){++event_id,p->id,kind,strength};
}
static void collision_sound(const char *name,const char *path,float volume,bool loop,bool restart){
    (void)path;(void)loop;(void)restart;if(sound_player&&(!strcmp(name,"wood")||!strcmp(name,"stone")))event(name,sound_player,volume);
}
static void wildlife_json(const golf_wildlife_t *w) {
    printf(",\"world\":%d,\"stage\":%d,\"course\":%d,\"wildlife\":[",w->world,w->stage,w->course);
    for(int i=0;i<3;i++) {
        const golf_wild_animal_t *a=&w->animals[i];
        printf("%s{\"kind\":%d,\"active\":%s,\"visible\":%s,\"presence\":%.5g,\"pos\":[%.7g,%.7g,%.7g],\"forward\":[%.7g,0,%.7g],\"walking\":%s,\"clock\":%.7g,\"stride\":%.7g,\"speed\":%.7g,\"gait\":%.7g,\"action\":%d,\"actionTime\":%.7g}",i?",":"",i,(a->active&&i==mechanics.third_kind)?"true":"false",(a->active&&a->present)?"true":"false",a->presence,a->pos.x,a->pos.y,a->pos.z,a->forward.x,a->forward.z,a->walking?"true":"false",a->clock,a->stride,a->speed,a->gait,a->action,a->action_time);
    }
    printf("],\"acceptedShots\":%u,\"puddles\":[",w->accepted_shots);
    int count=0;for(int i=0;i<GOLF_PUDDLES;i++)if(w->puddles[i].active){
        const golf_puddle_t *p=&w->puddles[i];printf("%s{\"id\":%u,\"pos\":[%.7g,%.7g,%.7g],\"born\":%u,\"remaining\":%d}",count++?",":"",p->id,p->pos.x,p->pos.y,p->pos.z,p->born,p->remaining);
    }printf("]");
}

int main(int argc, char **argv) {
    if(argc<2||argc>3||(argc==3&&strcmp(argv[2],"--planner")))return 2;
    planner_only=argc==3;
    level_id=path_hash(argv[1]);
    headless_config_load();
    if (!headless_level_load(&level,argv[1])) return 2;
    golf_bvh_init(&static_bvh); golf_bvh_init(&dynamic_bvh);
    world.level=&level; world.config=&config; world.static_bvh=&static_bvh; world.dynamic_bvh=&dynamic_bvh;
    world.multiplayer=true;
    world.sound=collision_sound;
    world.funnel_radius=CFG_NUM(&config,"multiplayer_funnel_radius");
    world.funnel_force=CFG_NUM(&config,"multiplayer_funnel_force");
    world.capture_radius=CFG_NUM(&config,"multiplayer_capture_radius");
    world.capture_max_speed=CFG_NUM(&config,"multiplayer_capture_max_speed");
    for (int i=0;i<level.entities.length;i++) if (level.entities.data[i].type==BALL_START_ENTITY) { spawn=level.entities.data[i].ball_start.transform.position; spawn.y+=GOLF_BALL_RADIUS; }
    golf_physics_build_world(&world,false);
    golf_mechanics_init(&mechanics,&level,&static_bvh);
    navigation=golf_mechanics_navigation();
    printf("{\"type\":\"ready\",\"spawn\":[%.9g,%.9g,%.9g]}\n",spawn.x,spawn.y,spawn.z); fflush(stdout);
    char line[sizeof(planner_snapshot_t)*2+4096];
    while (fgets(line,sizeof(line),stdin)) {
        JSON_Value *value=json_parse_string(line); JSON_Object *o=json_value_get_object(value);
        const char *cmd=json_object_get_string(o,"cmd"); int request=(int)json_object_get_number(o,"request"), slot=(int)json_object_get_number(o,"slot");
        bool ok=false;
        if (cmd && !strcmp(cmd,"configure")) {
            mechanics.enabled=json_object_get_boolean(o,"mascots")==1;
            mechanics.impact=json_object_get_boolean(o,"impact")==1;
            golf_mechanics_seed(&mechanics,(uint32_t)json_object_get_number(o,"seed"),json_object_has_value(o,"previousPet")?(int)json_object_get_number(o,"previousPet"):-1);golf_mechanics_animate(&mechanics,world.time);
            float probability=(float)json_object_get_number(o,"forwardProbability");
            mechanics.forward_probability=isfinite(probability)?golf_clampf(probability,0,1):.5f;ok=true;
        } else if(cmd&&!strcmp(cmd,"plannerState")&&!planner_only&&slot>=0&&slot<GOLF_MAX_PLAYERS){
            planner_snapshot_json(request,slot);fflush(stdout);json_value_free(value);continue;
        } else if(cmd&&!strcmp(cmd,"restorePlanner")&&planner_only){
            ok=restore_planner(json_object_get_string(o,"state"));
        } else if(cmd&&!strcmp(cmd,"prepareBots")){
            golf_bot_prepare(&world,&mechanics,navigation);
        } else if(cmd&&!strcmp(cmd,"plan")&&slot>=0&&slot<GOLF_MAX_PLAYERS){
            const char *difficulty=json_object_get_string(o,"difficulty");int d=difficulty&&!strcmp(difficulty,"expert")?3:difficulty&&!strcmp(difficulty,"hard")?2:difficulty&&!strcmp(difficulty,"medium")?1:0;
            golf_player_t *p=&players[slot];bool available=p->id&&p->connected&&!p->ball.is_moving&&!p->ball.is_in_hole&&!p->ball.capture_until;
            golf_bot_plan_t plan={0};if(available){golf_bot_observe(&bot_memory[slot],p,navigation);plan=golf_bot_plan_adaptive(&world,&mechanics,navigation,p,d,&bot_memory[slot]);}
            printf("{\"request\":%d,\"ok\":%s,\"direction\":[%.9g,0,%.9g],\"power\":%.9g,\"candidates\":%d,\"lookahead\":%d,\"safe\":%s,\"landing\":[%.9g,%.9g,%.9g],\"peak\":%.9g,\"launchSpeed\":%.9g,\"wait\":%.9g,\"stalled\":%d,\"reused\":%s,\"cpuMs\":%.3f,\"wallMs\":%.3f}\n",request,available?"true":"false",plan.direction.x,plan.direction.z,plan.power,plan.candidates,plan.lookahead,plan.safe?"true":"false",plan.landing.x,plan.landing.y,plan.landing.z,plan.peak,plan.launch_speed,plan.wait,bot_memory[slot].stalled,plan.reused?"true":"false",plan.cpu_ms,plan.wall_ms);
            fflush(stdout);json_value_free(value);continue;
        } else if (cmd && !strcmp(cmd,"add") && slot>=0 && slot<GOLF_MAX_PLAYERS) {
            golf_player_init(&players[slot],(uint32_t)json_object_get_number(o,"id"),"",V4(1,1,1,1),0); golf_player_start_level(&players[slot],spawn);memset(&bot_memory[slot],0,sizeof(bot_memory[slot]));ok=true;
        } else if (cmd && !strcmp(cmd,"connected") && slot>=0 && slot<GOLF_MAX_PLAYERS) { players[slot].connected=json_object_get_boolean(o,"connected")==1; ok=true;
        } else if (cmd && !strcmp(cmd,"shot") && slot>=0 && slot<GOLF_MAX_PLAYERS) { vec3 direction=golf_json_object_get_vec3(o,"direction");float power=(float)json_object_get_number(o,"power");ok=golf_physics_shoot(&world,&players[slot],direction,power);if(ok){golf_wildlife_shot(&mechanics.wildlife,&players[slot]);golf_bot_record(&bot_memory[slot],&players[slot],direction,power);event("shot",&players[slot],power);}
        } else if (cmd && !strcmp(cmd,"step")) {
            int ticks=(int)json_object_get_number(o,"ticks"); if (ticks<0 || ticks>1200) ticks=0;
            bool full_players=getenv("GOLF_PHYSICS_FULL_PLAYERS")!=NULL;
            for (int t=0;t<ticks;t++) {
                world.time+=1.0f/120;
                golf_physics_build_world(&world,true);
                golf_ball_t inputs[GOLF_MAX_PLAYERS];bool simulated[GOLF_MAX_PLAYERS]={0};
                for (int i=0;i<GOLF_MAX_PLAYERS;i++) {
                    golf_player_t *p=&players[i]; if (!p->id || !p->connected || p->ball.is_in_hole) continue;
                    bool was_hole=p->ball.is_in_hole;inputs[i]=p->ball;int same=-1;
                    if(!full_players)for(int j=0;j<i;j++)if(simulated[j]&&!memcmp(&inputs[i],&inputs[j],sizeof(golf_ball_t))){same=j;break;}
                    if(same>=0)p->ball=players[same].ball;
                    else {sound_player=p;golf_physics_tick_player(&world,p,1.0f/120);sound_player=NULL;}
                    simulated[i]=true;
                    // Equal inputs share only this pure physics step. Every
                    // player's identity, score, NPC effects and Impact remain
                    // independent in mechanics below. Duplicate impact audio
                    // is deliberately mixed once instead of thirty times.
                    if(!was_hole&&p->ball.is_in_hole)event("hole",p,1);
                    /* Shared mechanics starts the maritaca rescue, also offline. */
                }
                uint32_t hits[GOLF_MAX_PLAYERS],effects[GOLF_MAX_PLAYERS];float captures[GOLF_MAX_PLAYERS];vec3 velocities[GOLF_MAX_PLAYERS];
                for(int i=0;i<GOLF_MAX_PLAYERS;i++){hits[i]=players[i].ball.cat_hits;effects[i]=players[i].ball.effect_serial;captures[i]=players[i].ball.capture_until;velocities[i]=players[i].ball.vel;}
                golf_mechanics_tick(&mechanics,players,GOLF_MAX_PLAYERS,world.time);
                for(int i=0;i<GOLF_MAX_PLAYERS;i++)if(players[i].id){
                    if(players[i].ball.effect_serial!=effects[i]){
                        const char *kinds[]={"","romeu","luna","frida","portal"};
                        event(kinds[players[i].ball.effect_kind],&players[i],1);
                    }
                    else if(players[i].ball.cat_hits!=hits[i])event("slap",&players[i],1);
                    else if(!captures[i]&&players[i].ball.capture_until)event("capture",&players[i],1);
                    else if(mechanics.impact&&!captures[i]&&vec3_distance(velocities[i],players[i].ball.vel)>.8f)event("impact",&players[i],golf_clampf(vec3_distance(velocities[i],players[i].ball.vel)/8,.1f,1));
                }
                for(int i=0;i<GOLF_MAX_PLAYERS;i++)players[i].ball.draw_pos=players[i].ball.pos;
            }
            printf("{\"request\":%d,\"ok\":true,\"time\":%.9g,\"cpuMs\":%.3f,\"rssBytes\":%zu,\"memoryBytes\":%zu,\"mascots\":{\"enabled\":%s,\"cat\":[%.9g,%.9g,%.9g],\"dog\":[%.9g,%.9g,%.9g],\"slapTime\":%.9g,\"wakeTime\":%.9g,\"catActive\":%s,\"dogActive\":%s,\"catVisible\":%s,\"dogVisible\":%s,\"thirdKind\":%d,\"catPresence\":%.5g,\"dogPresence\":%.5g,\"catPhase\":%.5g",request,world.time,cpu_ms(),rss_bytes(),headless_allocated_bytes(),mechanics.enabled?"true":"false",mechanics.cat.x,mechanics.cat.y,mechanics.cat.z,mechanics.dog.x,mechanics.dog.y,mechanics.dog.z,mechanics.cat_slap_time,mechanics.dog_wake_time,mechanics.cat_valid?"true":"false",mechanics.dog_valid?"true":"false",mechanics.cat_present?"true":"false",mechanics.dog_present?"true":"false",mechanics.third_kind,mechanics.cat_presence,mechanics.dog_presence,mechanics.cat_phase);
            wildlife_json(&mechanics.wildlife);printf("},\"players\":[");
            bool comma=false;
            for (int i=0;i<GOLF_MAX_PLAYERS;i++) if (players[i].id) {
                golf_player_t *p=&players[i]; golf_ball_t *b=&p->ball;
                printf("%s{\"id\":%u,\"pos\":[%.9g,%.9g,%.9g],\"vel\":[%.9g,%.9g,%.9g],\"moving\":%s,\"hole\":%s,\"water\":%s,\"strokes\":%d,\"firstComplete\":%s,\"captured\":%s,\"captureUntil\":%.9g,\"slowShots\":%d,\"slowUntil\":%.9g,\"captureKind\":%d,\"effectKind\":%d,\"effectTime\":%.9g,\"effectSerial\":%u,\"wildlifeProtection\":%.9g,\"rescueStarted\":%.9g,\"rescueFrom\":[%.9g,%.9g,%.9g]}",comma?",":"",p->id,b->pos.x,b->pos.y,b->pos.z,b->vel.x,b->vel.y,b->vel.z,b->is_moving?"true":"false",b->is_in_hole?"true":"false",b->is_in_water?"true":"false",p->stroke_count,b->first_shot_complete?"true":"false",b->captured?"true":"false",b->capture_until,b->slow_shots,b->slow_until,b->capture_kind,b->effect_kind,b->effect_time,b->effect_serial,b->wildlife_protection,b->rescue_started,b->rescue_from.x,b->rescue_from.y,b->rescue_from.z); comma=true;
            }
            printf("],\"events\":[");for(int i=0;i<event_count;i++)printf("%s{\"id\":%u,\"player\":%u,\"kind\":\"%s\",\"strength\":%.5g}",i?",":"",events[i].id,events[i].player,events[i].kind,events[i].strength);
            puts("]}");event_count=0; fflush(stdout); json_value_free(value); continue;
        }
        printf("{\"request\":%d,\"ok\":%s,\"thirdKind\":%d}\n",request,ok?"true":"false",mechanics.third_kind); fflush(stdout); json_value_free(value);
    }
    return 0;
}
