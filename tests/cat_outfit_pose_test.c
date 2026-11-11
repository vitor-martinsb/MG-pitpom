#include "golf/cat_pose.h"
#include "golf/seasonal_pose.h"
#undef NDEBUG
#include <assert.h>
#include <stdio.h>
int main(void){
    const vec3 directions[]={ {1,0,0},{0,0,1},{.6f,0,.8f} };
    for(int dir=0;dir<3;dir++)for(int phase=0;phase<8;phase++)for(int sample=1;sample<36000;sample++){
        float t=sample/120.f,offset=phase*.7f,span=1.45f;
        golf_cat_pose_t p=golf_cat_patrol_pose(t,offset,span,directions[dir]);
        float speed=span*.95f*cosf(golf_cat_patrol_angle(t,offset));
        assert(vec3_dot(p.forward,vec3_scale(directions[dir],speed))>=-.00001f);
        vec3 nose=vec3_apply_mat4(V3(0,0,1),0,mat4_rotation_y(atan2f(p.forward.x,p.forward.z)));
        assert(vec3_dot(nose,vec3_scale(directions[dir],speed))>=-.00001f);
        assert(p.gait>=0&&p.gait<=1&&isfinite(p.stride));
        golf_cat_pose_t before=golf_cat_patrol_pose(t-1.f/120,offset,span,directions[dir]);assert(p.stride+.003f>=before.stride);
    }
    for(int frame=0;frame<100;frame++){golf_cat_pose_t idle=golf_cat_patrol_pose(frame,2,0,V3(1,0,0));assert(idle.forward.x==1&&idle.stride==0&&idle.gait==0);}
    const vec3 sizes[]={ {.22f,.22f,.40f},{.23f,.21f,.41f},{.23f,.21f,.34f} };
    for(int pet=0;pet<3;pet++)for(int frame=0;frame<120;frame++)for(int ring=0;ring<=16;ring++)for(int segment=0;segment<32;segment++){
        float a=-MF_PI*.5f+ring*MF_PI/16,b=segment*2*MF_PI/32;
        vec3 normal=V3(cosf(a)*cosf(b),sinf(a),cosf(a)*sinf(b)),center=V3(0,.34f+.015f*sinf(frame*.3f),pet?-.04f:0);
        vec3 skin=vec3_add(center,V3(normal.x*sizes[pet].x,normal.y*sizes[pet].y,normal.z*sizes[pet].z));
        vec3 coat=golf_season_coat_point(center,sizes[pet],normal),offset=vec3_sub(coat,skin);
        assert(fabsf(vec3_length(offset)-.009f)<.00001f);assert(vec3_dot(offset,normal)>.00899f);
        vec3 moved=golf_season_coat_point(vec3_add(center,V3(0,.045f,0)),sizes[pet],normal);
        assert(fabsf(moved.y-coat.y-.045f)<.000001f&&moved.x==coat.x&&moved.z==coat.z);
    }
    assert(golf_season_coat_open(V3(.5f,-.7f,.6f)));assert(golf_season_coat_open(V3(0,.1f,-.99f)));assert(!golf_season_coat_open(V3(0,0,1)));
    puts("Pompom: forward gait follows the real patrol clock; three fitted costumes keep a 9 mm offset and move with their torso.");return 0;
}
