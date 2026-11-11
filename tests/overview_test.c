#include "golf/overview.h"
#undef NDEBUG
#include <assert.h>
int main(void){
    float aspects[]={.35f,.46f,1,1.6f,3};
    vec3 sizes[]={ {6,0,12},{30,8,8},{4,15,80},{300,20,450} };
    for(int a=0;a<5;a++)for(int s=0;s<4;s++){
        vec3 min=V3(-3,-2,5),max=vec3_add(min,sizes[s]);float skyline=max.y+2;
        vec3 pos=golf_overview_position(min,max,skyline,aspects[a]);
        vec3 center=vec3_scale(vec3_add(min,max),.5f),forward=vec3_normalize(vec3_sub(center,pos));
        vec3 right=vec3_normalize(vec3_cross(forward,V3(0,1,0))),up=vec3_cross(right,forward);
        assert(pos.y>skyline);
        float elevation=asinf(-forward.y)*180/MF_PI;
        assert(elevation>30&&elevation<45); /* Perspective, never straight down. */
        assert(fabsf(forward.x)>.25f&&fabsf(forward.z)>.5f);
        float far=golf_overview_far_plane(min,max,skyline,pos);
        max.y=skyline; /* Include the tallest obstacles in the fit. */
        for(int c=0;c<8;c++){
            vec3 corner=V3(c&1?max.x:min.x,c&2?max.y:min.y,c&4?max.z:min.z),d=vec3_sub(corner,pos);
            float z=vec3_dot(d,forward),y=vec3_dot(d,up),x=vec3_dot(d,right);
            assert(z>.1f&&z<far);assert(fabsf(y/z)<tanf(33*MF_PI/180));assert(fabsf(x/z)<aspects[a]*tanf(33*MF_PI/180));
        }
    }
    return 0;
}
