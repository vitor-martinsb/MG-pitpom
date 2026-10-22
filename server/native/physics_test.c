#include "golf/physics.h"
#undef NDEBUG
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

void headless_config_load(void);
bool headless_level_load(golf_level_t *,const char *);
static vec3 water_velocity(vec3 direction,int triangles,int steps,float dt) {
    golf_level_t empty={0};golf_entity_t water={0};water.type=WATER_ENTITY;water.parent_idx=-1;
    golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);
    golf_bvh_aabb_t box={V3(-10,5,-10),V3(10,5,10)};
    for(int i=0;i<triangles;i++){
        golf_bvh_face_t face={0};face.level=&empty;face.entity=&water;
        face.a=V3(-10,5,-10);face.b=V3(0,5,10);face.c=V3(10,5,-10);face.water_dir=direction;
        vec_push(&fixed.faces,face);
    }
    golf_bvh_node_t leaf={0};leaf.is_leaf=true;leaf.aabb=box;leaf.leaf_node_info.face_count=triangles;
    vec_push(&fixed.nodes,leaf);fixed.parent=0;
    golf_config_t config={0};golf_physics_world_t world={0};world.level=&empty;world.config=&config;world.static_bvh=&fixed;world.dynamic_bvh=&moving;world.multiplayer=true;
    golf_player_t p;golf_player_init(&p,1,"Current",V4(1,1,1,1),0);golf_player_start_level(&p,V3(0,5.06f,0));p.ball.is_moving=true;
    for(int i=0;i<steps;i++){
        // Keep the probe immersed to compare equal contact durations.
        p.ball.pos=V3(0,5.06f,0);p.ball.vel.y=0;
        golf_physics_tick_player(&world,&p,dt);assert(p.ball.is_in_water);
        if(vec3_length(direction)>.00001f){assert(fabsf(p.ball.vel.y)<.00001f);assert(p.ball.pos.y>=5.059f);}
        else assert(p.ball.vel.y<-.08f); // Still-water hazards retain gravity.
    }
    vec3 result=p.ball.vel;vec_deinit(&fixed.faces);vec_deinit(&fixed.nodes);return result;
}
static void floating_current(void){
    golf_level_t level={0};golf_entity_t water={0},kill={0};
    golf_entity_t parent={0};parent.type=GEO_ENTITY;parent.parent_idx=-1;
    parent.geo.transform.scale=V3(1,1,1);parent.geo.transform.rotation=QUAT(0,0,0,1);
    vec_push(&level.entities,parent);
    water.type=WATER_ENTITY;water.parent_idx=0;kill.type=GEO_ENTITY;kill.parent_idx=0;
    kill.geo.transform.scale=V3(1,1,1);kill.geo.transform.rotation=QUAT(0,0,0,1);
    golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);
    for(int i=0;i<2;i++){
        golf_bvh_face_t f={0};f.level=&level;f.entity=i?&kill:&water;float y=i?4.96f:5;
        f.a=V3(-20,y,-20);f.b=V3(0,y,20);f.c=V3(20,y,-20);
        f.water_dir=V3(1,0,0);f.vel_scale=i?0:1;vec_push(&fixed.faces,f);
    }
    golf_bvh_node_t leaf={0};leaf.is_leaf=true;leaf.aabb=(golf_bvh_aabb_t){V3(-20,4.96f,-20),V3(20,5,20)};
    leaf.leaf_node_info.face_count=2;vec_push(&fixed.nodes,leaf);fixed.parent=0;
    golf_config_t config={0};golf_physics_world_t w={0};w.level=&level;w.config=&config;w.static_bvh=&fixed;w.dynamic_bvh=&moving;w.multiplayer=true;
    golf_player_t p;golf_player_init(&p,1,"River",V4(1,1,1,1),0);golf_player_start_level(&p,V3(0,5.06f,0));p.ball.is_moving=true;
    for(int tick=0;tick<240;tick++){
        w.time+=1.f/120;golf_physics_tick_player(&w,&p,1.f/120);
        assert(p.ball.is_in_water&&!p.ball.is_out_of_bounds);
        assert(p.ball.pos.y>5.059f&&p.ball.pos.y<5.2f);
    }
    assert(p.ball.pos.x>5&&p.ball.vel.x>3.8f&&p.stroke_count==0);
    vec_deinit(&fixed.faces);vec_deinit(&fixed.nodes);vec_deinit(&level.entities);
}
static void currents(void){
    vec3 one=water_velocity(V3(1,0,0),1,120,1.f/120);
    vec3 seam=water_velocity(V3(1,0,0),2,120,1.f/120);
    vec3 scaled=water_velocity(V3(8,0,0),3,120,1.f/120);
    vec3 finer=water_velocity(V3(1,0,0),1,240,1.f/240);
    assert(one.x>3&&one.x<4);assert(fabsf(one.x-seam.x)<.0001f);
    assert(fabsf(one.x-scaled.x)<.0001f&&fabsf(one.x-finer.x)<.0001f);
    // A bend changes the local push; rotated flow must rotate acceleration.
    vec3 bend=water_velocity(V3(0,0,-3),2,120,1.f/120);
    assert(fabsf(bend.x)<.0001f&&fabsf(bend.z+one.x)<.0001f);
    vec3 still=water_velocity(V3(0,0,0),1,1,1.f/120);assert(still.x==0&&still.z==0);
}
static void curved_stream(void){
    golf_level_t empty={0};golf_entity_t water={0};water.type=WATER_ENTITY;water.parent_idx=-1;
    strcpy(water.name,"evolution-stream-test");water.water.transform.scale=V3(2,1,1);water.water.transform.rotation=QUAT(0,0,0,1);
    golf_model_t *model=&water.water.geo.model;model->is_water=true;
    const vec3 points[]={V3(0,0,0),V3(2,0,0),V3(2,0,2),V3(2,0,2),V3(4,0,2),V3(5,0,4)};
    const vec2 uv[]={V2(0,0),V2(1,0),V2(1,-1),V2(0,-1),V2(1,-1),V2(1,-2)};
    for(int i=0;i<6;i++){vec_push(&model->positions,points[i]);vec_push(&model->texcoords,uv[i]);}
    for(int i=0;i<2;i++){golf_model_group_t group={0};group.start_vertex=i*3;group.vertex_count=3;vec_push(&model->groups,group);}
    vec_push(&model->water_dir,V3(0,0,1));vec_push(&model->water_dir,V3(1,0,0));
    golf_bvh_t bvh;golf_bvh_init(&bvh);golf_bvh_node_info(&bvh,0,&empty,&water,0);
    assert(bvh.faces.length==2);
    assert(fabsf(bvh.faces.data[0].water_dir.z-1)<.0001f);
    vec3 bend=bvh.faces.data[1].water_dir;
    assert(bend.x>.7f&&bend.z>.7f&&fabsf(bend.x-bend.z)<.0001f);
    // Legacy water keeps its authored vectors across separate material groups.
    strcpy(water.name,"original-water");bvh.faces.length=0;golf_bvh_node_info(&bvh,0,&empty,&water,0);
    assert(bvh.faces.data[0].water_dir.z==1&&bvh.faces.data[1].water_dir.x==2&&bvh.faces.data[1].water_dir.z==0);
    vec_deinit(&bvh.faces);vec_deinit(&model->positions);vec_deinit(&model->texcoords);vec_deinit(&model->groups);vec_deinit(&model->water_dir);
}
static void resting_cache(void){
    golf_level_t level={0};golf_entity_t ground={0};ground.type=GEO_ENTITY;ground.parent_idx=-1;
    ground.geo.transform.scale=V3(1,1,1);ground.geo.transform.rotation=QUAT(0,0,0,1);
    golf_bvh_t fixed,moving;golf_bvh_init(&fixed);golf_bvh_init(&moving);
    golf_bvh_face_t f={0};f.level=&level;f.entity=&ground;f.a=V3(-20,5,-20);f.b=V3(0,5,20);f.c=V3(20,5,-20);f.vel_scale=1;f.friction=.6f;
    vec_push(&fixed.faces,f);golf_bvh_node_t n={0};n.is_leaf=true;n.leaf_node_info.face_count=1;n.aabb=(golf_bvh_aabb_t){V3(-20,5,-20),V3(20,5,20)};
    vec_push(&fixed.nodes,n);fixed.parent=0;
    golf_config_t config={0};golf_physics_world_t w={0};w.level=&level;w.config=&config;w.static_bvh=&fixed;w.dynamic_bvh=&moving;w.multiplayer=true;
    golf_player_t p;golf_player_init(&p,1,"Rest",V4(1,1,1,1),0);golf_player_start_level(&p,V3(0,5.12f,0));
    golf_physics_tick_player(&w,&p,1.f/120);assert(p.ball.resting_static);vec3 before=p.ball.pos;
    for(int i=0;i<120;i++)golf_physics_tick_player(&w,&p,1.f/120);
    assert(vec3_distance(before,p.ball.pos)==0&&!p.ball.is_moving);
    // A moving obstacle entering the cached ball's area forces normal collision processing.
    f.a=V3(.1f,4,-1);f.b=V3(.1f,6,0);f.c=V3(.1f,4,1);vec_push(&moving.faces,f);
    n.aabb=(golf_bvh_aabb_t){V3(.1f,4,-1),V3(.1f,6,1)};vec_push(&moving.nodes,n);moving.parent=0;
    golf_physics_tick_player(&w,&p,1.f/120);assert(!p.ball.resting_static);
    moving.parent=-1;p.ball.vel=V3(1,0,0);golf_physics_tick_player(&w,&p,1.f/120);
    assert(p.ball.is_moving&&p.ball.pos.x>before.x);
    p.ball.is_moving=false;p.ball.resting_static=true;p.ball.resting_pos=p.ball.pos;p.ball.resting_vel=p.ball.vel;p.ball.pos.x=40;
    golf_physics_tick_player(&w,&p,1.f/120);assert(!p.ball.resting_static);
    vec_deinit(&fixed.faces);vec_deinit(&fixed.nodes);vec_deinit(&moving.faces);vec_deinit(&moving.nodes);
}
int main(int argc,char **argv) {
    headless_config_load();
    resting_cache();
    currents();
    floating_current();
    curved_stream();
    golf_level_t level={0}; assert(headless_level_load(&level,argc>1?argv[1]:"data/levels/level-3.level"));
    golf_config_t config={0}; golf_bvh_t fixed,moving; golf_bvh_init(&fixed); golf_bvh_init(&moving);
    golf_physics_world_t world={0}; world.level=&level;world.config=&config;world.static_bvh=&fixed;world.dynamic_bvh=&moving;
    world.multiplayer=true;world.funnel_radius=CFG_NUM(&config,"multiplayer_funnel_radius");world.funnel_force=CFG_NUM(&config,"multiplayer_funnel_force");world.capture_radius=CFG_NUM(&config,"multiplayer_capture_radius");world.capture_max_speed=CFG_NUM(&config,"multiplayer_capture_max_speed");
    golf_physics_build_world(&world,false);
    vec3 hole=V3(0,0,0);
    for(int i=0;i<level.entities.length;i++) if(level.entities.data[i].type==HOLE_ENTITY)hole=level.entities.data[i].hole.transform.position;
    golf_player_t p; golf_player_init(&p,1,"Test",V4(1,1,1,1),0);
    golf_player_start_level(&p,vec3_add(hole,V3(.3f,GOLF_BALL_RADIUS,0)));
    p.ball.is_moving=true;
    float last_y=p.ball.pos.y;bool descended=false;
    for(int i=0;i<1200&&!p.ball.is_in_hole;i++) {
        vec3 previous=p.ball.pos;
        world.time+=1.f/120;golf_physics_build_world(&world,true);golf_physics_tick_player(&world,&p,1.f/120);
        assert(isfinite(p.ball.pos.x)&&isfinite(p.ball.pos.y)&&isfinite(p.ball.pos.z));
        assert(vec3_distance(previous,p.ball.pos)<.08f);
        if(p.ball.pos.y<last_y-.01f)descended=true;
    }
    printf("Hole test: captured=%d position=(%g,%g,%g)\n",p.ball.is_in_hole,p.ball.pos.x,p.ball.pos.y,p.ball.pos.z);
    assert(descended&&p.ball.is_in_hole);
    assert(!p.ball.is_moving);
    assert(!golf_physics_shoot(&world,&p,V3(0,0,-1),.5f));
    golf_player_start_level(&p,vec3_add(hole,V3(.6f,GOLF_BALL_RADIUS,0)));
    p.ball.is_moving=true;p.ball.vel=V3(4,0,0);
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);assert(p.ball.pos.x>hole.x+.6f);
    /* A ball inside the cup, off-center, used to miss the narrow trigger. */
    golf_player_start_level(&p,vec3_add(hole,V3(.24f,-.4f,0)));
    p.ball.is_moving=true;p.ball.vel=V3(0,-1,0);
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(p.ball.is_in_hole);
    vec3 captured=p.ball.pos;
    for(int i=0;i<720;i++)golf_physics_tick_player(&world,&p,1.f/120);
    assert(vec3_equal(p.ball.pos,captured));assert(!p.ball.is_out_of_bounds);
    /* A fast downward step must not skip over the whole capture volume. */
    golf_player_start_level(&p,vec3_add(hole,V3(0,.2f,0)));
    p.ball.is_moving=true;p.ball.vel=V3(0,-180,0);
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(p.ball.is_in_hole);assert(p.ball.pos.y>hole.y-.8f);
    for(int direction=0;direction<8;direction++) {
        float angle=direction*MF_PI/4;
        golf_player_start_level(&p,vec3_add(hole,V3(.3f*cosf(angle),GOLF_BALL_RADIUS,.3f*sinf(angle))));
        p.ball.is_moving=true;
        for(int i=0;i<1200&&!p.ball.is_in_hole;i++) {
            vec3 previous=p.ball.pos;
            golf_physics_tick_player(&world,&p,1.f/120);
            assert(vec3_distance(previous,p.ball.pos)<.08f);
            assert(p.ball.pos.y>hole.y-.8f);
        }
        assert(p.ball.is_in_hole);assert(vec3_length(p.ball.vel)==0);
        captured=p.ball.pos;
        for(int i=0;i<720;i++)golf_physics_tick_player(&world,&p,1.f/120);
        assert(vec3_equal(p.ball.pos,captured));
    }
    golf_player_start_level(&p,vec3_add(hole,V3(0,1,0)));
    p.ball.is_moving=true;
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);
    golf_player_start_level(&p,vec3_add(hole,V3(.36f,-.2f,0)));
    p.ball.is_moving=true;
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);
    golf_level_t empty={0};world.level=&empty;
    golf_player_start_level(&p,V3(0,-.4f,0));p.ball.is_moving=true;
    golf_physics_tick_player(&world,&p,1.f/120);
    assert(!p.ball.is_in_hole);
    puts("Cup capture: eight rim directions, off-center descent, swept fast fall, stable finish and no false positives passed.");
    return 0;
}
