/* Volumetric companions share the existing garden actor primitives/materials. */
static void companion_face(garden_mesh_t *mesh,float time,bool benedita,bool gaze){
    vec4 fur=benedita?paint(.13f,.105f,.105f,0):paint(.98f,.70f,.37f,0),dark=paint(.065f,.05f,.05f,0),cream=paint(1,.87f,.64f,0);
    oval(mesh,V3(0,0,0),V3(.245f,.24f,.22f),fur,4,10);
    for(int side=-1;side<=1;side+=2){
        oval(mesh,V3(side*.225f,-.035f,-.015f),V3(.12f,.21f,.12f),fur,4,9);
        if(benedita)for(int i=0;i<4;i++)oval(mesh,V3(side*(.23f+.02f*sinf(i)),.1f-i*.085f,.025f),V3(.10f,.075f,.10f),paint(.19f,.15f,.14f,0),3,7);
        float eye=fmodf(time,4.5f)<.13f&&!gaze?.006f:.062f;
        oval(mesh,V3(side*.1f,.035f,.193f),V3(.057f,eye,.025f),paint(.97f,.93f,.84f,0),3,8);
        oval(mesh,V3(side*.1f,.035f,.212f),V3(.044f,eye*.88f,.018f),paint(.46f,.22f,.07f,0),3,8);
        oval(mesh,V3(side*.1f,.04f,.226f),V3(.026f,eye*.8f,.01f),dark,3,8);
        if(eye>.01f)oval(mesh,V3(side*.088f,.06f,.238f),V3(gaze?.019f:.009f,.012f,.006f),gaze?paint(1,.65f,.85f,0):paint(1,1,1,0),2,6);
        oval(mesh,V3(side*.055f,-.083f,.195f),V3(.09f,.07f,.07f),benedita?paint(.24f,.18f,.16f,0):cream,3,8);
    }
    oval(mesh,V3(0,-.04f,.27f),V3(.055f,.037f,.036f),dark,3,8);
    oval(mesh,V3(0,-.14f,.21f),V3(.065f,.035f,.035f),dark,3,8);
    if(!gaze)oval(mesh,V3(.01f,-.15f,.24f),V3(.035f,.04f,.01f),paint(.97f,.34f,.48f,0),3,7);
    if(benedita){
        for(int i=0;i<5;i++){float angle=i*MF_PI/4;oval(mesh,V3(cosf(angle)*.19f,sinf(angle)*.18f,.025f),V3(.10f,.095f,.10f),fur,3,8);}
        // The rose tiara and forehead pendant stay centered on her skull.
        for(int i=-1;i<=1;i++)oval(mesh,V3(i*.055f,.211f+(i==0?.035f:0),.085f),V3(.035f,.035f,.028f),paint(.99f,.16f,.57f,0),3,8);
        oval(mesh,V3(0,.145f,.191f),V3(.04f,.045f,.02f),paint(.98f,.22f,.68f,0),3,9);
        for(int i=0;i<6;i++){float angle=i*MF_PI/3;oval(mesh,V3(cosf(angle)*.052f,.145f+sinf(angle)*.052f,.19f),V3(.012f,.012f,.012f),paint(1,.89f,.94f,0),2,5);}
    }
}
static void companions_draw(garden_mesh_t *mesh,golf_game_t *game,float time){
    golf_companions_t *c=&game->mechanics.wildlife.companions;
    golf_companion_t *b=&c->benedita,*s=&c->smanata;
    if(b->active){
        mat4 base=mat4_multiply(mat4_translation(b->draw_pos),mat4_rotation_y(atan2f(b->forward.x,b->forward.z)));garden.transform=base;
        vec4 fur=paint(.13f,.105f,.10f,0);
        oval(mesh,V3(0,.35f,-.06f),V3(.26f,.30f,.29f),fur,4,10);
        for(int side=-1;side<=1;side+=2){oval(mesh,V3(side*.23f,.18f,-.15f),V3(.16f,.18f,.19f),fur,3,9);branch(mesh,V3(side*.13f,.39f,.1f),V3(side*.14f,.07f,.21f),.075f,.06f,fur);oval(mesh,V3(side*.15f,.065f,.23f),V3(.10f,.065f,.13f),fur,3,8);}
        float yaw=atan2f(b->look.x,b->look.z)-atan2f(b->forward.x,b->forward.z);yaw=atan2f(sinf(yaw),cosf(yaw));yaw=golf_clampf(yaw,-1.15f,1.15f);
        if(!b->state&&time<b->cooldown)yaw+=.25f*golf_clampf((b->cooldown-time)/5,0,1);
        garden.transform=mat4_multiply(base,mat4_multiply(mat4_translation(V3(0,.77f,.04f)),mat4_rotation_y(yaw)));
        companion_face(mesh,!b->state&&b->cooldown-time>4.82f?0:time,true,b->state!=0);
        garden.transform=mat4_identity();
    }
    if(s->active){
        float gait=golf_clampf(s->speed/3,0,1),bob=.012f*gait*sinf(s->stride*2);
        mat4 base=mat4_multiply(mat4_translation(s->draw_pos),mat4_rotation_y(atan2f(s->forward.x,s->forward.z)));garden.transform=base;
        vec4 coat=paint(.17f,.12f,.11f,0),gold=paint(.91f,.57f,.24f,0);
        oval(mesh,V3(0,.35f+bob,-.10f),V3(.24f,.23f,.37f),coat,4,10);
        oval(mesh,V3(0,.38f+bob,.18f),V3(.16f,.19f,.07f),gold,3,8);
        for(int side=-1;side<=1;side+=2)for(int back=0;back<2;back++){
            float z=back?-.34f:.16f,step=sinf(s->stride+(side>0?MF_PI:0)+back*MF_PI)*.08f*gait;
            vec3 hip=V3(side*.17f,.36f+bob,z),knee=V3(side*.18f,.18f,z+step*.5f),paw=V3(side*.18f,.055f+fmaxf(0,step)*.45f,z+step);
            branch(mesh,hip,knee,.075f,.055f,coat);branch(mesh,knee,paw,.055f,.045f,gold);oval(mesh,paw,V3(.08f,.055f,.10f),gold,3,8);
        }
        vec3 tail[]={V3(-.08f,.43f,-.40f),V3(-.20f,.52f,-.51f),V3(-.22f+.08f*sinf(time*9),.64f,-.48f)};
        branch(mesh,tail[0],tail[1],.065f,.05f,coat);branch(mesh,tail[1],tail[2],.05f,.025f,gold);
        garden.transform=mat4_multiply(base,mat4_translation(V3(0,.64f+bob,.21f)));companion_face(mesh,time,false,false);
        garden.transform=mat4_identity();
        for(int i=0;i<game->player_count;i++)if(game->players[i].id==s->player&&game->players[i].ball.capture_kind==GOLF_CAPTURE_SMANATA){golf_player_t *p=&game->players[i];oval(mesh,golf_smanata_mouth(s,true),V3(p->ball.radius,p->ball.radius,p->ball.radius),paint(p->color.x,p->color.y,p->color.z,0),4,10);break;}
    }
    garden.transform=mat4_identity();
    for(int i=0;i<game->player_count;i++)if(game->players[i].ball.capture_kind==GOLF_CAPTURE_BENEDITA){
        vec3 p=game->players[i].ball.draw_pos;
        for(int j=0;j<8;j++){float angle=time*1.6f+j*MF_PI/4;vec3 spark=vec3_add(p,V3(cosf(angle)*.22f,.12f+sinf(angle*2)*.07f,sinf(angle)*.22f));oval(mesh,spark,V3(.018f,.018f,.018f),paint(1,.54f,.78f,0),2,5);}
    }
}
