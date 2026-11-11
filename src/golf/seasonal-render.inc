/* Seasonal presentation uses the existing garden shader and depth buffer.
 * No decoration contributes a collision face. Fixed budgets are independent
 * of the number of courses or network participants. */
#define SEASON_VERTICES 36000
static garden_vertex_t season_vertices[SEASON_VERTICES];
static sg_buffer season_buffer;
static int season_vertex_count;
int golf_season_vertex_count(void){return season_theme?season_vertex_count:0;}
#ifdef GOLF_PLATFORM_EMSCRIPTEN
EMSCRIPTEN_KEEPALIVE
#endif
int golf_season_settings(int theme,int skin,int trail,int obstacles){
    if(theme<0)return season_theme;
    season_theme=theme==1;season_skin=skin>=0&&skin<5?skin:0;
    season_trail=trail>=0&&trail<5?trail:0;season_obstacles=season_theme&&obstacles;
    return season_theme;
}
bool golf_season_solo_obstacles(void){return season_obstacles!=0;}
vec4 golf_season_ball_color(const golf_player_t *p){
    if(!season_theme)return p->color;
    int skin=golf_online_active()?p->season_skin:season_skin;
    const vec4 colors[]={{.85f,.08f,.12f,1},{.18f,.53f,.30f,1},{.94f,.98f,1,1},{.62f,.32f,.13f,1},{.96f,.76f,.21f,1}};
    return colors[skin>=0&&skin<5?skin:0];
}
static vec4 festive(int n){
    const vec4 colors[]={{.85f,.16f,.18f,0},{.98f,.79f,.29f,0},{.23f,.65f,.42f,0},{.57f,.73f,.97f,0},{.96f,.87f,.69f,0}};
    return colors[(unsigned)n%5];
}
static void season_star(garden_mesh_t *m,vec3 p,float r,vec4 color){
    for(int i=0;i<10;i++){
        float a=i*MF_PI/5,b=(i+1)*MF_PI/5,ra=i%2?r*.42f:r,rb=i%2?r:r*.42f;
        triangle(m,p,vec3_add(p,V3(sinf(a)*ra,cosf(a)*ra,0)),vec3_add(p,V3(sinf(b)*rb,cosf(b)*rb,0)),color);
    }
}
static void season_gift(garden_mesh_t *m,vec3 p,float size,int color,float t){
    vec4 ribbon=festive(1);p.y+=size;
    box(m,p,V3(size,size,size),festive(color));
    box(m,vec3_add(p,V3(0,size+.008f,0)),V3(size+.01f,.012f,size+.01f),festive(color));
    box(m,p,V3(size*.15f,size+.026f,size+.026f),ribbon);
    box(m,p,V3(size+.026f,size+.026f,size*.15f),ribbon);
    for(int side=-1;side<=1;side+=2)oval(m,vec3_add(p,V3(side*size*.3f,size+.035f+sinf(t)*.008f,0)),V3(size*.3f,.035f,.06f),ribbon,2,5);
}
/* Tailored torso surfaces use the same position, breathing and gait as the
 * original bodies. Trim and buttons are face colors, never detached meshes. */
static void season_pet_coat(garden_mesh_t *m,int kind,vec3 center,vec3 size){
    if(!season_theme||!(kind==1||kind==3||kind==4))return;
    vec4 cream=paint(.98f,.96f,.88f,0),red=festive(0),gold=festive(1),green=festive(2);
    for(int ring=0;ring<8;ring++)for(int segment=0;segment<20;segment++){
        vec3 n[4];for(int j=0;j<4;j++)n[j]=sphere_point(-MF_PI*.5f+MF_PI*(ring+(j>=2))/8.f,2*MF_PI*(segment+(j==1||j==2))/20.f);
        vec3 mid=vec3_scale(vec3_add(n[0],n[2]),.5f);if(golf_season_coat_open(mid))continue;
        vec4 color=kind==1?red:kind==3?green:paint(.68f,.36f,.16f,0);
        if(mid.y<-.55f)color=kind==3?gold:cream;
        if(kind==1&&mid.y<0&&mid.y>-.25f){color=paint(.13f,.15f,.14f,0);if(mid.z>.80f&&fabsf(mid.x)<.20f)color=gold;}
        if(kind==3&&mid.y>.25f&&mid.z>.40f)color=red;
        if(kind==4){
            if(fabsf(mid.x)>.76f&&mid.z>.20f)color=cream;
            if(mid.z>.80f&&fabsf(mid.x)<.22f)color=ring%2?red:green;
        }
        int indices[]={0,1,2,0,2,3};for(int k=0;k<6;k++){vec3 v=n[indices[k]];emit(m,golf_season_coat_point(center,size,v),v,color);}
    }
}
/* Head accessories share the animal's local transform and current head pose. */
static void season_costume(garden_mesh_t *m,int kind,float head,float t){
    if(!season_theme)return;
    vec4 white=paint(.98f,.96f,.88f,0),red=festive(0),gold=festive(1),green=festive(2);
    if(kind==2)oval(m,V3(0,.45f,-.045f),V3(.243f,.237f,.43f),white,3,8);
    if(kind==0){
        for(int side=-1;side<=1;side+=2){
            vec3 a=V3(side*.16f,head+.18f,.29f),b=V3(side*.21f,head+.47f,.25f);
            branch(m,a,b,.024f,.012f,paint(.51f,.29f,.15f,0));
            branch(m,vec3_add(a,V3(0,.15f,0)),V3(side*.34f,head+.42f,.24f),.016f,.008f,gold);
        }
        oval(m,V3(0,head-.04f,.68f),V3(.058f,.042f,.032f),red,3,7);
    }else if(kind==1||kind==3){
        float z=kind==1?.32f:.29f,base=head+(kind==1?.22f:.23f)*.84f;
        float width=kind==1?.25f:.245f,tip=.10f+.025f*sinf(t*2);
        branch(m,V3(0,base+.012f,z),V3(tip,base+.31f,z-.02f),width*.88f,.008f,kind==1?red:green);
        oval(m,V3(0,base,z),V3(width+.012f,.032f,.245f),white,3,12);
        oval(m,V3(tip,base+.31f,z-.02f),V3(.055f,.055f,.055f),kind==1?white:gold,2,6);
    }else if(kind==2){
        branch(m,V3(0,head+.14f,.27f),V3(0,head+.35f,.27f),.12f,.12f,paint(.10f,.13f,.14f,0));
        oval(m,V3(0,head+.15f,.27f),V3(.21f,.026f,.21f),paint(.10f,.13f,.14f,0),2,8);
        oval(m,V3(0,.49f,.29f),V3(.24f,.05f,.23f),white,2,8);
        box(m,V3(.13f,.35f,.40f),V3(.05f,.16f,.02f),red);
    }else if(kind==6){
        // Ribbons follow the torso; paws, tail and face remain unobstructed.
        box(m,V3(0,.39f,-.04f),V3(.035f,.018f,.29f),red);
        oval(m,V3(0,.39f,.02f),V3(.23f,.034f,.10f),gold,2,8);
        for(int side=-1;side<=1;side+=2)oval(m,V3(side*.07f,.44f,.02f),V3(.08f,.04f,.055f),red,2,6);
    }
}
static void season_snowman(garden_mesh_t *m,vec3 p,float size,float time){
    vec4 snow=paint(.92f,.95f,.98f,0),coal=paint(.13f,.18f,.21f,0);
    oval(m,vec3_add(p,V3(0,size*.48f,0)),V3(size*.4f,size*.48f,size*.4f),snow,3,8);
    oval(m,vec3_add(p,V3(0,size*1.06f,0)),V3(size*.28f,size*.28f,size*.28f),snow,3,8);
    for(int side=-1;side<=1;side+=2){
        oval(m,vec3_add(p,V3(side*size*.1f,size*1.11f,size*.26f)),V3(.025f,.025f,.015f),coal,2,5);
        branch(m,vec3_add(p,V3(side*size*.3f,size*.63f,0)),vec3_add(p,V3(side*size*.72f,size*(.8f+.06f*sinf(time*1.5f)),.05f)),.025f,.012f,paint(.45f,.27f,.15f,0));
    }
    branch(m,vec3_add(p,V3(0,size*1.02f,size*.24f)),vec3_add(p,V3(0,size*1.02f,size*.43f)),.04f,.001f,paint(.96f,.48f,.17f,0));
    oval(m,vec3_add(p,V3(0,size*.88f,0)),V3(size*.30f,.045f,size*.28f),festive(0),2,8);
}
static void season_obstacle(garden_mesh_t *m,const golf_season_item_t *o,float time){
    vec3 p=golf_season_position(o,time);vec4 white=paint(.94f,.97f,1,0);
    switch(o->kind){
    case SEASON_GIFT:case SEASON_PORTAL:
        season_gift(m,p,.22f,o->kind==SEASON_PORTAL?3:0,time);
        if(o->kind==SEASON_GIFT&&time>=o->action_time&&time-o->action_time<.85f){
            float lift=sinf((time-o->action_time)/.85f*MF_PI)*.35f;
            box(m,vec3_add(p,V3(0,.45f+lift,0)),V3(.24f,.025f,.24f),festive(0));
            for(int dot=0;dot<4;dot++)season_star(m,vec3_add(p,V3(sinf(dot*2.4f)*lift,.52f+lift,cosf(dot*2.4f)*lift)),.04f,festive(1));
        }
        if(o->kind==SEASON_PORTAL)season_star(m,vec3_add(p,V3(0,.65f+.06f*sinf(time*2),0)),.15f,festive(1));break;
    case SEASON_SNOWMAN:season_snowman(m,p,.60f,time);break;
    case SEASON_CANDY:{
        vec3 axis=V3(cosf(time*.7f+o->phase),0,sinf(time*.7f+o->phase));
        for(int j=0;j<8;j++)branch(m,vec3_add(p,vec3_add(V3(0,.13f,0),vec3_scale(axis,-.48f+j*.12f))),vec3_add(p,vec3_add(V3(0,.13f,0),vec3_scale(axis,-.36f+j*.12f))),.075f,.075f,j%2?white:festive(0));break;}
    case SEASON_SLEIGH:
        box(m,vec3_add(p,V3(0,.20f,0)),V3(.27f,.15f,.36f),festive(0));
        for(int s=-1;s<=1;s+=2)branch(m,vec3_add(p,V3(s*.23f,.04f,-.42f)),vec3_add(p,V3(s*.23f,.09f,.48f)),.027f,.027f,festive(1));
        season_gift(m,vec3_add(p,V3(0,.36f,0)),.12f,2,time);break;
    case SEASON_SNOWBALL:oval(m,vec3_add(p,V3(0,.31f,0)),V3(.31f,.31f,.31f),white,4,9);break;
    case SEASON_STAR:season_star(m,vec3_add(p,V3(0,.30f,0)),.30f,festive(1));break;
    case SEASON_ICE:
        for(int i=0;i<12;i++){float a=i*MF_PI/6,b=(i+1)*MF_PI/6;
            triangle(m,vec3_add(p,V3(0,.012f,0)),vec3_add(p,V3(cosf(a)*.62f,.012f,sinf(a)*.62f)),vec3_add(p,V3(cosf(b)*.62f,.012f,sinf(b)*.62f)),i%3?paint(.62f,.84f,.94f,0):white);}break;
    }
}

static void season_cabin(garden_mesh_t *m,vec3 p,float time){
    vec4 wood=paint(.48f,.28f,.17f,0),snow=paint(.92f,.95f,.96f,0),warm=paint(1,.75f,.30f,0);
    box(m,vec3_add(p,V3(0,.60f,0)),V3(.72f,.60f,.65f),wood);
    for(int side=-1;side<=1;side+=2){
        triangle(m,vec3_add(p,V3(0,1.65f,-.8f)),vec3_add(p,V3(side*.9f,1.15f,-.8f)),vec3_add(p,V3(side*.9f,1.15f,.8f)),snow);
        triangle(m,vec3_add(p,V3(0,1.65f,-.8f)),vec3_add(p,V3(side*.9f,1.15f,.8f)),vec3_add(p,V3(0,1.65f,.8f)),snow);
        box(m,vec3_add(p,V3(side*.4f,.73f,.66f)),V3(.17f,.20f,.014f),warm);
    }
    box(m,vec3_add(p,V3(0,.40f,.665f)),V3(.16f,.40f,.02f),paint(.24f,.17f,.14f,0));
    box(m,vec3_add(p,V3(.40f,1.55f,-.20f)),V3(.13f,.40f,.13f),wood);
    for(int i=0;i<5;i++){
        float rise=fmodf(time*.18f+i*.2f,1);vec3 q=vec3_add(p,V3(.40f+sinf(time*.3f+i)*rise*.22f,2+rise,-.20f));
        oval(m,q,V3(.05f+rise*.1f,.06f+rise*.08f,.05f+rise*.1f),paint(.78f,.81f,.82f,0),2,6);
    }
    // Wreath follows the door; bows and small bells are clearly separated.
    for(int i=0;i<8;i++){float a=i*MF_PI/4;oval(m,vec3_add(p,V3(cosf(a)*.11f,.85f+sinf(a)*.11f,.71f)),V3(.05f,.045f,.03f),festive(2),2,5);}
    oval(m,vec3_add(p,V3(0,.72f,.73f)),V3(.09f,.03f,.03f),festive(0),2,5);
    for(int i=0;i<8;i++)oval(m,vec3_add(p,V3((i-3.5f)*.18f,1.18f,.69f)),V3(.035f,.035f,.025f),festive(i),2,5);
    branch(m,vec3_add(p,V3(-.82f,1.12f,.64f)),vec3_add(p,V3(-.82f,1.04f,.64f)),.015f,.065f,festive(1));
}
static void season_reindeer(garden_mesh_t *m,vec3 p,float time){
    vec4 brown=paint(.60f,.37f,.20f,0);float breath=.012f*sinf(time*2);
    oval(m,vec3_add(p,V3(0,.55f+breath,0)),V3(.25f,.26f,.47f),brown,3,8);
    for(int i=0;i<4;i++)branch(m,vec3_add(p,V3(i%2?.17f:-.17f,.47f,i<2?.3f:-.3f)),vec3_add(p,V3(i%2?.17f:-.17f,.05f,i<2?.3f:-.3f)),.045f,.03f,brown);
    oval(m,vec3_add(p,V3(0,.95f,.41f)),V3(.20f,.24f,.21f),brown,3,8);
    for(int side=-1;side<=1;side+=2){branch(m,vec3_add(p,V3(side*.13f,1.10f,.4f)),vec3_add(p,V3(side*.18f,1.42f,.34f)),.024f,.01f,festive(1));branch(m,vec3_add(p,V3(side*.16f,1.25f,.37f)),vec3_add(p,V3(side*.30f,1.39f,.37f)),.018f,.008f,festive(1));oval(m,vec3_add(p,V3(side*.09f,1,.59f)),V3(.025f,.035f,.014f),paint(.10f,.13f,.12f,0),2,5);}
    oval(m,vec3_add(p,V3(0,.90f,.63f)),V3(.055f,.047f,.035f),festive(0),2,6);
}
static void season_elf(garden_mesh_t *m,vec3 p,float time){
    oval(m,vec3_add(p,V3(0,.26f,0)),V3(.16f,.23f,.13f),festive(2),3,7);
    oval(m,vec3_add(p,V3(0,.57f,0)),V3(.14f,.14f,.13f),paint(.93f,.72f,.54f,0),3,7);
    branch(m,vec3_add(p,V3(0,.67f,0)),vec3_add(p,V3(.05f,.93f,0)),.16f,.001f,festive(0));
    for(int side=-1;side<=1;side+=2){branch(m,vec3_add(p,V3(side*.11f,.34f,0)),vec3_add(p,V3(side*.29f,.38f+.09f*sinf(time*2),.02f)),.04f,.03f,festive(2));oval(m,vec3_add(p,V3(side*.05f,.59f,.12f)),V3(.015f,.02f,.01f),paint(.1f,.12f,.11f,0),2,4);}
}
static void season_draw(float time){
    if(!garden.level)return;
    if(!season_buffer.id)season_buffer=sg_make_buffer(&(sg_buffer_desc){.size=sizeof(season_vertices),.usage=SG_USAGE_STREAM,.label="seasonal-garden"});
    garden_mesh_t mesh={season_vertices,0,SEASON_VERTICES};garden.transform=mat4_identity();
    golf_game_t *game=golf_game_get();
    if(!season_theme){
        for(int i=0;i<game->mechanics.season.count;i++)season_obstacle(&mesh,&game->mechanics.season.items[i],time);
        season_vertex_count=mesh.count;
        if(mesh.count){sg_update_buffer(season_buffer,&(sg_range){season_vertices,(size_t)mesh.count*sizeof(garden_vertex_t)});render(season_buffer,mesh.count,time,false,V4(1,1,0,0));}
        return;
    }
    // Ring outside the original play area: no tee, cup or obstacle occlusion.
    float extent=10;
    vec3 center=vec3_scale(vec3_add(game->mechanics.bounds_min,game->mechanics.bounds_max),.5f);
    for(int i=0;i<8;i++){
        float a=(i+.5f)*MF_PI/4;vec3 half=vec3_scale(vec3_sub(game->mechanics.bounds_max,game->mechanics.bounds_min),.5f);
        float corner=fmaxf(fabsf(cosf(a)),fabsf(sinf(a)));
        vec3 p=vec3_add(center,V3(cosf(a)/corner*(half.x+3),-.20f,sinf(a)/corner*(half.z+3)));
        float base=game->mechanics.bounds_min.y-(garden.biome==2||garden.biome==7?1.05f:garden.biome==8?5:.32f);
        float edge=fmaxf(fmaxf(game->mechanics.bounds_min.x-p.x,p.x-game->mechanics.bounds_max.x),fmaxf(game->mechanics.bounds_min.z-p.z,p.z-game->mechanics.bounds_max.z));
        p.y=base+golf_clampf(edge/12,0,1)*(1.6f+.8f*sinf(p.x*.18f)*cosf(p.z*.13f));
        float h=1.4f+variation(i+garden.biome)*.8f;
        for(int tier=0;tier<3;tier++)branch(&mesh,vec3_add(p,V3(0,.25f+tier*h*.22f,0)),vec3_add(p,V3(0,h*(.72f+tier*.14f),0)),h*(.38f-tier*.07f),.01f,paint(.11f,.36f+.02f*garden.biome,.24f,0));
        season_star(&mesh,vec3_add(p,V3(0,h*1.07f,0)),.17f,festive(1));
        for(int bulb=0;bulb<9;bulb++){
            float y=.35f+bulb*h*.06f,r=h*.3f*(1-y/h),b=bulb*2.4f;
            oval(&mesh,vec3_add(p,V3(cosf(b)*r,y,sinf(b)*r)),V3(.06f,.06f,.06f),festive((bulb+i)%5),2,5);
        }
        if(i%2)season_gift(&mesh,vec3_add(p,V3(.8f,0,0)),.22f,i,time);
        if(i==0)season_cabin(&mesh,vec3_add(p,V3(1.5f,0,0)),time);
        if(i==4){season_reindeer(&mesh,vec3_add(p,V3(1.6f,0,0)),time);golf_season_item_t sleigh={.kind=SEASON_SLEIGH,.pos=vec3_add(p,V3(2.6f,0,0)),.phase=0};season_obstacle(&mesh,&sleigh,time);}
        if(i==1)season_elf(&mesh,vec3_add(p,V3(1,0,0)),time);
        if(i==2||i==6)season_snowman(&mesh,vec3_add(p,V3(1,0,0)),.9f,time);
        // Sparse snow beneath the tree, distinct from the playable surface.
        oval(&mesh,vec3_add(p,V3(0,-.04f,0)),V3(h*.48f,.05f,h*.48f),paint(.89f,.93f,.95f,0),2,8);
    }
    int decorated=0;
    for(int i=0;i<garden.level->entities.length&&decorated<10;i++){
        golf_entity_t *e=&garden.level->entities.data[i];if(e->type!=MODEL_ENTITY||!strstr(e->model.model_path,"/tree_"))continue;
        golf_model_t *model=e->model.model;if(!model)continue;float top=-FLT_MAX,bottom=FLT_MAX;
        for(int j=0;j<model->positions.length;j++){top=fmaxf(top,model->positions.data[j].y);bottom=fminf(bottom,model->positions.data[j].y);}
        if(top<=bottom)continue;decorated++;float h=top-bottom;
        garden.transform=golf_transform_get_model_mat(golf_entity_get_world_transform(garden.level,e));
        for(int bulb=0;bulb<8;bulb++){float a=bulb*2.4f,y=bottom+h*(.60f+bulb*.025f),r=h*.27f;
            oval(&mesh,V3(cosf(a)*r,y,sinf(a)*r),V3(h*.018f,h*.018f,h*.018f),festive(bulb),2,4);
        }
        oval(&mesh,V3(0,top-.02f,0),V3(h*.18f,h*.025f,h*.18f),paint(.91f,.95f,.96f,0),2,6);
    }
    garden.transform=mat4_identity();
    // Ice accents on water are visual only: water remains a hazard.
    int ice=0;for(int i=0;garden.biome!=7&&garden.biome!=8&&i<game->physics.static_bvh.faces.length&&ice<12;i++){
        golf_bvh_face_t *f=&game->physics.static_bvh.faces.data[i];if(!f->entity||f->entity->type!=WATER_ENTITY)continue;
        vec3 q=vec3_scale(vec3_add(vec3_add(f->a,f->b),f->c),1.f/3);q.y+=.015f;
        triangle(&mesh,q,vec3_add(q,V3(.17f,.003f,.07f)),vec3_add(q,V3(-.04f,.003f,.22f)),paint(.79f,.93f,.98f,0));ice++;
    }
    for(int i=0;i<game->mechanics.season.count;i++)season_obstacle(&mesh,&game->mechanics.season.items[i],time);
    // Distant stars and a slow aurora stay above the course silhouette.
    vec3 forward=vec3_sub(garden.center,golf_graphics_get()->cam_pos);forward.y=0;
    if(vec3_length(forward)<.01f)forward=V3(0,0,1);forward=vec3_normalize(forward);
    vec3 right=V3(forward.z,0,-forward.x),sky=vec3_add(garden.center,vec3_scale(forward,garden.radius*.65f));
    for(int i=0;i<24;i++){
        vec3 p=vec3_add(sky,vec3_add(vec3_scale(right,(variation(i*3)-.5f)*60),V3(0,9+variation(i*5)*15,0)));
        oval(&mesh,p,V3(.06f,.06f,.06f),festive(4),2,4);
    }
    for(int i=0;i<12;i++){
        float x=(i-6)*4,y=13+sinf(i*.6f+time*.06f)*1.5f;
        vec3 a=vec3_add(sky,vec3_add(vec3_scale(right,x),V3(0,y,0))),b=vec3_add(sky,vec3_add(vec3_scale(right,x+4),V3(0,13+sinf((i+1)*.6f+time*.06f)*1.5f,0)));
        vec4 color=paint(.14f+i*.003f,.32f+garden.biome*.002f,.38f+i*.003f,0);
        triangle(&mesh,a,b,vec3_add(b,V3(0,.25f,0)),color);triangle(&mesh,a,vec3_add(b,V3(0,.25f,0)),vec3_add(a,V3(0,.25f,0)),color);
    }
    vec3 snow_center=game->mechanics.start;
    for(int i=0;i<game->player_count;i++)if(game->players[i].id==game->local_player_id)snow_center=game->players[i].ball.draw_pos;
    // Bounded world-space snowfall follows the camera's coverage, not the tee.
    // Wrapping happens at the distant edge rather than moving every flake.
    // Geometry budget does not grow with player count.
    for(int i=0;i<64;i++){
        float x=(variation(i*7+1)-.5f)*extent*2,z=(variation(i*11+3)-.5f)*extent*2;
        x=snow_center.x+fmodf(fmodf(x-snow_center.x,extent*2)+extent*2,extent*2)-extent;
        z=snow_center.z+fmodf(fmodf(z-snow_center.z,extent*2)+extent*2,extent*2)-extent;
        vec3 p=V3(x+sinf(time*.27f+i)*.22f,snow_center.y+1+fmodf(variation(i+9)*8+80-time*.35f,8),z);
        triangle(&mesh,p,vec3_add(p,V3(.035f,.045f,0)),vec3_add(p,V3(.065f,0,.015f)),paint(.91f,.95f,1,0));
    }
    for(int i=0;i<game->player_count;i++){
        golf_player_t *p=&game->players[i];if(!golf_game_player_visible(p)||p->ball.is_in_hole)continue;
        bool local=!golf_online_active();int skin=local?season_skin:p->season_skin,trail=local?season_trail:p->season_trail;
        vec3 q=golf_garden_ball_position(p,time);float r=p->ball.radius*1.015f;
        // Restrained shell; the existing colored identification ring remains.
        bool detail=i<12||p->id==game->local_player_id;
        garden.transform=mat4_multiply(mat4_translation(q),mat4_from_quat(p->ball.orientation));
        q=V3(0,0,0);
        if(detail&&skin==1){box(&mesh,q,V3(r*.13f,r*1.01f,r*.6f),festive(1));box(&mesh,q,V3(r*.6f,r*1.01f,r*.13f),festive(1));}
        else if(detail)for(int dot=0;dot<4;dot++){float a=dot*2.4f;vec3 v=vec3_add(q,V3(cosf(a)*r*.68f,r*.73f,sinf(a)*r*.68f));if(skin==4)season_star(&mesh,v,r*.20f,paint(1,.97f,.74f,0));else oval(&mesh,v,V3(r*.14f,r*.12f,r*.14f),festive(4),2,4);}
        garden.transform=mat4_identity();q=golf_garden_ball_position(p,time);
        float speed=vec3_length(p->ball.vel);if(speed>.15f&&detail){vec3 back=vec3_scale(vec3_normalize(p->ball.vel),-.07f);
            for(int dot=0;dot<5;dot++){vec3 v=vec3_add(q,vec3_scale(back,(float)(dot+1)));v.y+=.015f*sinf(time*4+dot);
                if(trail==3)season_gift(&mesh,v,.016f,dot,time);
                else if(trail==0){for(int ray=0;ray<3;ray++){float a=ray*MF_PI/3;branch(&mesh,vec3_add(v,V3(cosf(a)*.026f,sinf(a)*.026f,0)),vec3_add(v,V3(-cosf(a)*.026f,-sinf(a)*.026f,0)),.003f,.003f,festive(4));}}
                else if(trail==4)oval(&mesh,v,V3(.022f,.022f,.022f),festive(dot),2,4);
                else season_star(&mesh,v,trail==1?.025f:.013f,trail==1?festive(1):festive(dot));}
        }
    }
    season_vertex_count=mesh.count;
    if(mesh.count){sg_update_buffer(season_buffer,&(sg_range){season_vertices,(size_t)mesh.count*sizeof(garden_vertex_t)});render(season_buffer,mesh.count,time,false,V4(1,1,0,0));}
}
