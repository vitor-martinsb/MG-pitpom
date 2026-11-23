/* Alfredo shares the existing volumetric actor mesh, materials and lighting. */
static float alfredo_ease(float t){t=golf_clampf(t,0,1);return t*t*(3-2*t);}
static void alfredo_draw(garden_mesh_t *mesh,golf_game_t *game,float time){
    golf_companion_t *a=&game->mechanics.wildlife.companions.alfredo;if(!a->active)return;
    float age=fmaxf(0,time-a->until),roll=0;
    if(a->state==ALFREDO_ROLL)roll=alfredo_ease(age/.55f);
    else if(a->state==ALFREDO_JUGGLE||a->state==ALFREDO_KICK)roll=1;
    else if(a->state==ALFREDO_RECOVER)roll=1-alfredo_ease(age/.85f);
    float sit=a->state==ALFREDO_IDLE||a->state==ALFREDO_COOLDOWN?1:0;
    float gait=golf_clampf(a->speed/2,0,1),bob=.012f*gait*sinf(a->stride*2);
    mat4 base=mat4_multiply(mat4_translation(a->draw_pos),mat4_rotation_y(atan2f(a->forward.x,a->forward.z)));
    // Rotate the COMPLETE connected skeleton around its body, never detached paws.
    garden.transform=mat4_multiply(base,mat4_multiply(mat4_translation(V3(0,.34f+bob,0)),mat4_multiply(mat4_rotation_z(roll*MF_PI),mat4_translation(V3(0,-.34f,0)))));
    mat4 body=garden.transform;
    vec4 orange=paint(.96f,.49f,.10f,0),stripe=paint(.65f,.27f,.06f,0),cream=paint(1,.82f,.53f,0),pink=paint(.96f,.46f,.44f,0),ink=paint(.18f,.09f,.05f,0),red=paint(.83f,.09f,.07f,0);
    oval(mesh,V3(0,.34f+.04f*sit,-.06f-.02f*sit),V3(.24f,.25f+.07f*sit,.34f-.08f*sit),orange,4,10);
    oval(mesh,V3(0,.35f,.22f),V3(.17f,.19f,.055f),cream,3,8);
    for(int side=-1;side<=1;side+=2){
        if(sit)oval(mesh,V3(side*.18f,.17f,-.20f),V3(.12f,.16f,.17f),orange,3,8);
        for(int k=0;k<3;k++)oval(mesh,V3(side*.222f,.38f,-.24f+k*.13f),V3(.021f,.09f,.025f),stripe,2,6);
        for(int back=0;back<2;back++){
            float contact=a->state==ALFREDO_JUGGLE||a->state==ALFREDO_KICK?expf(-age*13):0;
            contact*=a->state==ALFREDO_KICK?(back?2.2f:.45f):1;
            float step=sinf(a->stride+(side>0?MF_PI:0)+back*MF_PI)*.07f*gait;
            vec3 hip=V3(side*.15f,.33f,back?-.26f:.14f),knee=V3(side*.16f,.17f,(back?-.26f:.14f)+step*.5f),paw=V3(side*.16f,.065f-contact*.11f,(back?-.27f:.20f)+step+contact*.08f);
            if(back&&sit){knee=V3(side*.22f,.14f,-.20f);paw=V3(side*.19f,.065f,-.10f);}
            branch(mesh,hip,knee,.065f,.05f,orange);branch(mesh,knee,paw,.05f,.045f,orange);oval(mesh,paw,V3(.075f,.062f,.095f),cream,3,8);
            if(roll>.5f)oval(mesh,vec3_add(paw,V3(0,-.053f,0)),V3(.04f,.012f,.048f),pink,2,6);
        }
    }
    vec3 tail[]={V3(-.08f,.29f,-.35f),V3(-.30f,.31f,-.46f),V3(-.39f+.04f*sinf(time*2.5f),.48f,-.31f)};
    branch(mesh,tail[0],tail[1],.065f,.055f,orange);branch(mesh,tail[1],tail[2],.055f,.03f,stripe);
    float yaw=atan2f(a->look.x,a->look.z)-atan2f(a->forward.x,a->forward.z);yaw=atan2f(sinf(yaw),cosf(yaw));yaw=golf_clampf(yaw,-.65f,.65f)*(1-roll);
    garden.transform=mat4_multiply(body,mat4_multiply(mat4_translation(V3(0,.65f-.35f*roll,.16f+.28f*roll)),mat4_multiply(mat4_rotation_y(yaw),mat4_rotation_x(roll*.9f))));
    oval(mesh,V3(0,0,0),V3(.265f,.235f,.22f),orange,4,12);
    for(int side=-1;side<=1;side+=2){
        triangle(mesh,V3(side*.08f,.15f,.02f),V3(side*.21f,.37f,.00f),V3(side*.26f,.10f,.06f),orange);
        triangle(mesh,V3(side*.13f,.17f,.063f),V3(side*.21f,.30f,.04f),V3(side*.23f,.14f,.07f),pink);
        float eye=fmodf(time,5.1f)<.12f?.008f:.055f;
        oval(mesh,V3(side*.105f,.025f,.2f),V3(.065f,eye,.025f),cream,3,9);
        oval(mesh,V3(side*.105f,.025f,.221f),V3(.046f,eye*.9f,.015f),paint(.30f,.52f,.11f,0),3,9);
        oval(mesh,V3(side*.105f,.025f,.235f),V3(.019f,eye*.9f,.009f),ink,3,7);
        if(eye>.02f)oval(mesh,V3(side*.09f,.045f,.245f),V3(.010f,.012f,.006f),paint(1,1,1,0),2,5);
        oval(mesh,V3(side*.064f,-.08f,.21f),V3(.10f,.075f,.055f),cream,3,8);
        for(int k=0;k<3;k++)branch(mesh,V3(side*.12f,-.07f,.245f),V3(side*.32f,-.10f+k*.035f,.25f),.003f,.001f,cream);
        for(int k=0;k<2;k++)oval(mesh,V3(side*(.20f-k*.025f),.075f+k*.10f,.14f),V3(.043f,.018f,.035f),stripe,2,6);
    }
    oval(mesh,V3(0,-.04f,.274f),V3(.036f,.026f,.025f),pink,3,7);
    for(int k=-1;k<=1;k++)oval(mesh,V3(k*.06f,.17f,.135f),V3(.021f,.055f,.025f),stripe,2,6);
    // Red dinosaur bandana remains attached to the neck through the roll.
    oval(mesh,V3(0,-.17f,0),V3(.20f,.055f,.18f),red,3,10);
    triangle(mesh,V3(-.18f,-.16f,.17f),V3(0,-.39f,.25f),V3(.18f,-.16f,.17f),red);
    vec4 dinosaur=paint(1,.86f,.47f,0);
    oval(mesh,V3(.005f,-.23f,.216f),V3(.044f,.025f,.009f),dinosaur,2,6);
    branch(mesh,V3(.03f,-.23f,.217f),V3(.045f,-.19f,.197f),.014f,.014f,dinosaur);
    oval(mesh,V3(.06f,-.19f,.20f),V3(.025f,.014f,.008f),dinosaur,2,6);
    branch(mesh,V3(-.03f,-.23f,.214f),V3(-.07f,-.20f,.195f),.012f,.003f,dinosaur);
    for(int k=-1;k<=1;k+=2)branch(mesh,V3(k*.02f,-.24f,.226f),V3(k*.023f,-.27f,.228f),.009f,.008f,dinosaur);
    garden.transform=mat4_identity();
    for(int i=0;i<game->player_count;i++){
        golf_player_t *p=&game->players[i];golf_ball_t *b=&p->ball;
        if(p->id==a->player&&b->capture_kind==GOLF_CAPTURE_ALFREDO&&b->captured)oval(mesh,b->draw_pos,V3(b->radius,b->radius,b->radius),paint(p->color.x,p->color.y,p->color.z,0),4,9);
        float effect=time-b->effect_time;if(b->effect_kind!=GOLF_EFFECT_ALFREDO||effect<0||effect>.65f)continue;
        for(int k=0;k<4;k++){float t=k*.055f;vec3 at=vec3_sub(b->draw_pos,vec3_scale(b->vel,t));oval(mesh,at,V3(.012f,.012f,.012f),paint(1,.82f,.34f,0),2,5);}
    }
}
