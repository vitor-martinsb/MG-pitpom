import assert from 'node:assert/strict';
import {companionFrame} from './companions-fixture.mjs';
// Use the existing read-only planner snapshot to find an actual shot at the
// current patrol/wind time. Never teleport a ball or replace authority state.
export async function captureAlfredo(room,member,fire=(m,s)=>room.shot(m,s)){
 const initial=await companionFrame(room,0),a=initial.mascots.companions.alfredo,b=member.ball,physics=room.physics;
 assert.ok(a?.active,'the original test field has a compatible Alfredo area');
 const angle=Math.atan2(a.pos[0]-b.pos[0],a.pos[2]-b.pos[2]);
 const snapshot=await physics.command({cmd:'plannerState',slot:member.slot});assert.ok(snapshot.ok);
 console.log('Alfredo fixture',JSON.stringify({level:physics.level,time:initial.time,cat:a.pos,ball:b.pos}));
 const Planner=physics.constructor,preview=new Planner(physics.root,physics.level,true);let shot;const angles=[-.3,0,.3,-.6,.6,-1,1,...Array.from({length:32},(_,i)=>i*Math.PI/16)];
 try{
  await preview.ready;
  search:for(const power of [1,.7,.5,.3,.18,.12])for(const delta of angles){
   assert.ok((await preview.command({cmd:'restorePlanner',state:snapshot.state})).ok);
   const direction=[Math.sin(angle+delta),0,Math.cos(angle+delta)];assert.ok(await preview.shot(member.slot,direction,power));
   for(let i=0;i<90;i++){
    const f=await preview.step(30),ball=f.players.find(p=>p.id===member.id);
    if(ball.captureKind===9){shot={sequence:1,direction,power};break search;}
    if(ball.captureKind===6||ball.captureKind===8||(!ball.moving&&!ball.captureUntil))break;
   }
  }
 }finally{preview.close();}
 assert.ok(shot,'a real trajectory at the current simulation time reaches Alfredo');
 await fire(member,shot);
 for(let i=0;i<600;i++){
  const f=await companionFrame(room,5);
  if(member.ball.captureKind===9)return f;
 }
 throw Error('The authority must reproduce the read-only Alfredo forecast');
}
