#include "golf/mechanics.h"
#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <stdio.h>
void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static int roster(const golf_mechanics_t *m){
 const golf_companions_t *c=&m->wildlife.companions;
 int total=m->cat_present+m->dog_present+c->alfredo.active+c->benedita.active+c->smanata.active;
 assert(m->cat_present!=m->dog_present);
 assert(c->benedita.active==c->smanata.active);
 for(int i=0;i<GOLF_WILDLIFE_COUNT;i++){
  const golf_wild_animal_t *a=&m->wildlife.animals[i];
  assert(a->active==a->present);total+=a->present;
 }
 assert(total==3);
 if(c->benedita.active){assert(m->cat_present!=m->dog_present);assert(!c->alfredo.active);}
 return total;
}
int main(int argc,char **argv){
 headless_config_load();golf_level_t level={0};assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
 golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);golf_config_t config={0};
 golf_physics_world_t world={.level=&level,.config=&config,.static_bvh=&fixed,.dynamic_bvh=&moving};golf_physics_build_world(&world,false);
 golf_mechanics_t m;golf_mechanics_init(&m,&level,&fixed);int previous=-1;unsigned seen=0,residents=0;
 for(unsigned seed=1;seed<=(argc>1?32:128);seed++){
  golf_mechanics_seed(&m,seed,previous);roster(&m);assert(m.third_kind!=previous);
  unsigned mask=m.pet_mask;int choice=m.third_kind;seen|=1u<<choice;
  if(m.cat_present)residents|=1;if(m.dog_present)residents|=2;
  // Deterministic for solo/authority/reconnect, with a stable roster during play.
  golf_mechanics_seed(&m,seed,previous);assert(m.pet_mask==mask&&m.third_kind==choice);
  for(int time=0;time<4000;time+=397){golf_mechanics_animate(&m,(float)time);roster(&m);assert(m.pet_mask==mask);}
  previous=choice;
 }
 if(argc==1){assert((seen&0x7f)==0x7f);assert(residents==3);}
 printf("Three-pet roster: %s; mandatory Pituca/Pompom, inseparable friends, deterministic stable selection passed\n",argc>1?argv[1]:"128 seeds");return 0;
}
