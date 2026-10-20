/* Planner-only layered floor graph. The game's physics and NPC navigation stay
 * untouched; every candidate still runs through the original collision solver. */
static bool bot_ground(const golf_bvh_face_t *f){
    if(!f->entity||f->entity->type==WATER_ENTITY||f->vel_scale<=.1f)return false;
    if(f->entity->type==MODEL_ENTITY&&strstr(f->entity->model.model_path,"/platform_"))return false;
    vec3 n=vec3_normalize(vec3_cross(vec3_sub(f->b,f->a),vec3_sub(f->c,f->a)));
    return n.y>.65f;
}
static bool bot_segment(golf_bvh_t *bvh,vec3 a,vec3 b,float clearance){
    int steps=(int)ceilf(vec3_distance(a,b)/.23f);if(steps<1)steps=1;
    for(int i=0;i<=steps;i++){
        vec3 p=vec3_add(a,vec3_scale(vec3_sub(b,a),i/(float)steps));
        golf_bvh_face_t f;float t=FLT_MAX;int index;
        if(!golf_bvh_ray_test(bvh,vec3_add(p,V3(0,.15f,0)),V3(0,-1,0),&t,&index,&f)||!bot_ground(&f)||fabsf(t-.15f)>.10f)return false;
        vec3 floor=vec3_add(p,V3(0,.15f-t,0));
        golf_ball_contact_t contacts[16];int count=0;
        golf_bvh_ball_test(bvh,vec3_add(floor,V3(0,clearance+.025f,0)),clearance,V3(0,0,0),contacts,&count,16);
        for(int c=0;c<count;c++)if(contacts[c].is_water||contacts[c].is_out_of_bounds||fabsf(contacts[c].normal.y)<.65f)return false;
    }
    return true;
}
static void bot_layers(const golf_navigation_t *base,bool refine){
    golf_navigation_t *nav=&route.navigation;*nav=*base;nav->count=0;
    // Resolve bent, narrow openings missed by the normal 55 cm sampling.
    // Refine only when the complete graph fits the existing fixed budgets.
    if(refine&&base->count*2.5f<GOLF_NAV_NODES*.85f){
        float step=base->step*.64f;
        int width=(int)((base->max.x-base->min.x)/step)+1,height=(int)((base->max.z-base->min.z)/step)+1;
        if(width*height<GOLF_NAV_CELLS){nav->step=step;nav->width=width;nav->height=height;}
    }
    memset(route.heads,-1,sizeof(route.heads));memset(route.neighbor,-1,sizeof(route.neighbor));
    for(int z=0;z<nav->height;z++)for(int x=0;x<nav->width;x++){
        int cell=z*nav->width+x;
        vec3 origin=V3(nav->min.x+(x+.5f)*nav->step,nav->max.y+2,nav->min.z+(z+.5f)*nav->step);
        for(int layer=0;layer<12;layer++){
            golf_bvh_face_t f;float t=FLT_MAX;int index;
            if(!golf_bvh_ray_test(nav->floor,origin,V3(0,-1,0),&t,&index,&f))break;
            vec3 hit=vec3_add(origin,V3(0,-t,0));origin=vec3_sub(hit,V3(0,.04f,0));
            if(!bot_ground(&f)||nav->count>=GOLF_NAV_NODES)continue;
            golf_ball_contact_t contacts[16];int count=0;bool clear=true;
            golf_bvh_ball_test(nav->floor,vec3_add(hit,V3(0,.17f,0)),.14f,V3(0,0,0),contacts,&count,16);
            for(int c=0;c<count;c++)if(contacts[c].is_water||contacts[c].is_out_of_bounds||fabsf(contacts[c].normal.y)<.65f)clear=false;
            if(!clear)continue;
            int at=nav->count++;nav->nodes[at]=(golf_nav_node_t){.pos=hit,.cell=cell,.cost=FLT_MAX};
            route.next[at]=route.heads[cell];route.heads[cell]=(short)at;
        }
    }
    for(int i=0;i<nav->count;i++){
        int cell=nav->nodes[i].cell,x=cell%nav->width,z=cell/nav->width;
        for(int k=0;k<8;k++){
            int X=x+dx[k],Z=z+dz[k];if(X<0||Z<0||X>=nav->width||Z>=nav->height)continue;
            int best=-1;float height=.65f;
            for(int j=route.heads[Z*nav->width+X];j>=0;j=route.next[j]){
                float difference=fabsf(nav->nodes[i].pos.y-nav->nodes[j].pos.y);
                if(difference<height&&bot_segment(nav->floor,nav->nodes[i].pos,nav->nodes[j].pos,.14f)){best=j;height=difference;}
            }
            if(best>=0){route.neighbor[i][k]=(short)best;nav->nodes[i].edges|=1u<<k;}
        }
    }
}
