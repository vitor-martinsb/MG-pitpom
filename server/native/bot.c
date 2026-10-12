#include "bot.h"
#include <float.h>
#include <math.h>
#include <time.h>
static uint32_t hash(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
golf_bot_plan_t golf_bot_plan(golf_physics_world_t *world,const golf_mechanics_t *mechanics,const golf_navigation_t *nav,const golf_player_t *player,int difficulty){
    vec3 target=golf_nav_target(nav,player->ball.pos),delta=vec3_sub(target,player->ball.pos);
    float heading=atan2f(delta.x,delta.z),best=FLT_MAX;
    golf_bot_plan_t plan={.direction=V3(sinf(heading),0,cosf(heading)),.power=.2f};
    const float powers[]={0,.045f,.09f,.16f,.24f,.36f,.52f,.72f};
    const int counts[]={12,32,64};clock_t started=clock();
    for(int candidate=0;candidate<counts[difficulty];candidate++){
        float angle=heading;
        if(candidate>=8){int sector=(candidate/8+1)/2;angle+=sector*(candidate/8%2?1:-1)*(difficulty==2?.22f:.45f);}
        float power=powers[candidate%8];
        if(difficulty==2&&candidate>=8&&candidate<40){
            angle=heading+((candidate-8)/4)*MF_PI/4;
            const float exploratory[]={.08f,.22f,.44f,.72f};power=exploratory[(candidate-8)%4];
        }
        vec3 direction=V3(sinf(angle),0,cosf(angle));
        golf_player_t trial=*player;golf_physics_world_t w=*world;golf_mechanics_t m=*mechanics;m.impact=false;
        w.sound=NULL;w.stop_sound=NULL;w.ripple=NULL;w.contacts=NULL;
        if(!golf_physics_shoot(&w,&trial,direction,power))break;
        bool danger=false;
        for(int tick=0;tick<480;tick++){
            w.time+=1.f/120;golf_physics_tick_player(&w,&trial,1.f/120);golf_mechanics_tick(&m,&trial,1,w.time);
            if(trial.ball.is_in_hole)break;
            if(trial.ball.is_in_water||trial.ball.is_out_of_bounds||trial.ball.capture_until>0){danger=true;break;}
            if(!trial.ball.is_moving)break;
        }
        float travel=vec3_distance(trial.ball.pos,player->ball.pos);
        float score=trial.ball.is_in_hole?-10000:golf_nav_cost(nav,trial.ball.pos)+(danger?1000:0)+power*.04f;
        if(travel<.25f&&vec3_distance(player->ball.pos,mechanics->hole)>1)score+=2;
        if(score<best){best=score;plan.direction=direction;plan.power=power;}
        plan.candidates++;
        if(best<-9999||((clock()-started)/(double)CLOCKS_PER_SEC>.045&&plan.candidates>=8))break;
    }
    uint32_t seed=hash(mechanics->seed^player->id^(player->stroke_count*0x9e3779b9u));
    const float errors[]={.22f,.06f,.012f},force_errors[]={.13f,.04f,.009f};
    float angle=atan2f(plan.direction.x,plan.direction.z)+((seed&65535)/32767.5f-1)*errors[difficulty];
    plan.direction=V3(sinf(angle),0,cosf(angle));plan.power=golf_clampf(plan.power+((seed>>16)/32767.5f-1)*force_errors[difficulty],0,1);
    return plan;
}
