#include "golf/physics.h"
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
static golf_level_t level;
static golf_config_t config;
static golf_bvh_t static_bvh, dynamic_bvh;
static golf_physics_world_t world;
static vec3 spawn;

int main(int argc, char **argv) {
    if (argc != 2) return 2;
    headless_config_load();
    if (!headless_level_load(&level,argv[1])) return 2;
    golf_bvh_init(&static_bvh); golf_bvh_init(&dynamic_bvh);
    world.level=&level; world.config=&config; world.static_bvh=&static_bvh; world.dynamic_bvh=&dynamic_bvh;
    world.multiplayer=true;
    world.funnel_radius=CFG_NUM(&config,"multiplayer_funnel_radius");
    world.funnel_force=CFG_NUM(&config,"multiplayer_funnel_force");
    world.capture_radius=CFG_NUM(&config,"multiplayer_capture_radius");
    world.capture_max_speed=CFG_NUM(&config,"multiplayer_capture_max_speed");
    for (int i=0;i<level.entities.length;i++) if (level.entities.data[i].type==BALL_START_ENTITY) { spawn=level.entities.data[i].ball_start.transform.position; spawn.y+=GOLF_BALL_RADIUS; }
    golf_physics_build_world(&world,false);
    printf("{\"type\":\"ready\",\"spawn\":[%.9g,%.9g,%.9g]}\n",spawn.x,spawn.y,spawn.z); fflush(stdout);
    char line[16384];
    while (fgets(line,sizeof(line),stdin)) {
        JSON_Value *value=json_parse_string(line); JSON_Object *o=json_value_get_object(value);
        const char *cmd=json_object_get_string(o,"cmd"); int request=(int)json_object_get_number(o,"request"), slot=(int)json_object_get_number(o,"slot");
        bool ok=false;
        if (cmd && !strcmp(cmd,"add") && slot>=0 && slot<GOLF_MAX_PLAYERS) {
            golf_player_init(&players[slot],(uint32_t)json_object_get_number(o,"id"),"",V4(1,1,1,1),0); golf_player_start_level(&players[slot],spawn); ok=true;
        } else if (cmd && !strcmp(cmd,"connected") && slot>=0 && slot<GOLF_MAX_PLAYERS) { players[slot].connected=json_object_get_boolean(o,"connected")==1; ok=true;
        } else if (cmd && !strcmp(cmd,"shot") && slot>=0 && slot<GOLF_MAX_PLAYERS) { ok=golf_physics_shoot(&world,&players[slot],golf_json_object_get_vec3(o,"direction"),(float)json_object_get_number(o,"power"));
        } else if (cmd && !strcmp(cmd,"step")) {
            int ticks=(int)json_object_get_number(o,"ticks"); if (ticks<0 || ticks>1200) ticks=0;
            for (int t=0;t<ticks;t++) {
                world.time+=1.0f/120;
                golf_physics_build_world(&world,true);
                for (int i=0;i<GOLF_MAX_PLAYERS;i++) {
                    golf_player_t *p=&players[i]; if (!p->id || !p->connected || p->ball.is_in_hole) continue;
                    golf_physics_tick_player(&world,p,1.0f/120);
                    if (p->ball.is_out_of_bounds && (!p->ball.is_moving || p->ball.pos.y < CFG_NUM(&config,"physics_kill_y"))) {
                        vec3 start=p->ball.start_pos; int strokes=p->stroke_count; golf_player_start_level(p,start); p->stroke_count=strokes;
                    }
                    p->ball.draw_pos=p->ball.pos;
                }
            }
            printf("{\"request\":%d,\"ok\":true,\"time\":%.9g,\"cpuMs\":%.3f,\"rssBytes\":%zu,\"memoryBytes\":%zu,\"players\":[",request,world.time,cpu_ms(),rss_bytes(),headless_allocated_bytes());
            bool comma=false;
            for (int i=0;i<GOLF_MAX_PLAYERS;i++) if (players[i].id) {
                golf_player_t *p=&players[i]; golf_ball_t *b=&p->ball;
                printf("%s{\"id\":%u,\"pos\":[%.9g,%.9g,%.9g],\"vel\":[%.9g,%.9g,%.9g],\"moving\":%s,\"hole\":%s,\"water\":%s,\"strokes\":%d}",comma?",":"",p->id,b->pos.x,b->pos.y,b->pos.z,b->vel.x,b->vel.y,b->vel.z,b->is_moving?"true":"false",b->is_in_hole?"true":"false",b->is_in_water?"true":"false",p->stroke_count); comma=true;
            }
            puts("]}"); fflush(stdout); json_value_free(value); continue;
        }
        printf("{\"request\":%d,\"ok\":%s}\n",request,ok?"true":"false"); fflush(stdout); json_value_free(value);
    }
    return 0;
}
