#ifndef GOLF_BOT_BUDGET_H
#define GOLF_BOT_BUDGET_H
#include <stdlib.h>
#include <math.h>
#ifdef _WIN32
#include <windows.h>
#undef near
#undef far
static double bot_cpu_ms(void){FILETIME a,b,k,u;GetProcessTimes(GetCurrentProcess(),&a,&b,&k,&u);ULARGE_INTEGER x,y;x.LowPart=k.dwLowDateTime;x.HighPart=k.dwHighDateTime;y.LowPart=u.dwLowDateTime;y.HighPart=u.dwHighDateTime;return (x.QuadPart+y.QuadPart)/10000.;}
static double bot_wall_ms(void){LARGE_INTEGER t,f;QueryPerformanceCounter(&t);QueryPerformanceFrequency(&f);return t.QuadPart*1000./f.QuadPart;}
static void bot_pause(double ms){Sleep((DWORD)ceil(ms));}
#else
#include <time.h>
#include <sys/resource.h>
static double bot_cpu_ms(void){struct rusage u;getrusage(RUSAGE_SELF,&u);return (u.ru_utime.tv_sec+u.ru_stime.tv_sec)*1000.+(u.ru_utime.tv_usec+u.ru_stime.tv_usec)/1000.;}
static double bot_wall_ms(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec*1000.+t.tv_nsec/1e6;}
static void bot_pause(double ms){struct timespec t={0,(long)(ceil(ms)*1e6)};nanosleep(&t,NULL);}
#endif
static struct {bool enabled;double cpu,wall,fraction,limit;} bot_budget;
static void bot_budget_begin(void){
    const char *f=getenv("GOLF_BOT_CPU_FRACTION"),*l=getenv("GOLF_BOT_SEARCH_MS");
    double fraction=f?strtod(f,NULL):1,limit=l?strtod(l,NULL):0;
    if(!isfinite(fraction)||fraction<=0||fraction>1)fraction=1;
    if(!isfinite(limit)||limit<0||limit>5000)limit=0;
    bot_budget.enabled=fraction<1||limit>0;bot_budget.fraction=fraction;bot_budget.limit=limit;
    if(bot_budget.enabled){bot_budget.cpu=bot_cpu_ms();bot_budget.wall=bot_wall_ms();}
}
static void bot_budget_yield(void){
    if(!bot_budget.enabled||bot_budget.fraction>=1)return;
    double debt;
    while((debt=(bot_cpu_ms()-bot_budget.cpu)/bot_budget.fraction-(bot_wall_ms()-bot_budget.wall))>1)
        bot_pause(fmin(debt,25));
}
static bool bot_budget_expired(void){return bot_budget.enabled&&bot_budget.limit>0&&bot_cpu_ms()-bot_budget.cpu>=bot_budget.limit;}
#endif
