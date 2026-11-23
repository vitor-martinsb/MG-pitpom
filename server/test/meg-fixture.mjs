import assert from 'node:assert/strict';

// A real shot on the unmodified second map reaches Meg. No teleport or test-only
// worker command is used; this also exercises the actual capture collision.
export async function captureMeg(room,members,fire=(member,shot)=>room.shot(member,shot)){
  const physics=room.physics;
  const initial=await physics.step(0),meg=initial.mascots.wildlife[4];
  assert.ok(meg.active&&meg.visible);
  for(const member of members){
    const ball=initial.players.find(p=>p.id===member.id),dx=meg.pos[0]-ball.pos[0],dz=meg.pos[2]-ball.pos[2],length=Math.hypot(dx,dz);
    await fire(member,{sequence:1,direction:[dx/length,0,dz/length],power:.15});
  }
  let frame;
  for(let tick=0;tick<40;tick++){
    frame=await physics.step(60);
    if(members.every(m=>frame.players.find(p=>p.id===m.id).captureKind===6))break;
  }
  for(const member of members)assert.equal(frame.players.find(p=>p.id===member.id).captureKind,6,'a real shot must reach Meg');
  frame=await physics.step(30); // Observe a stable hold after the capture animation.
  room.worldTime=frame.time;room.mascots=frame.mascots;
  for(const ball of frame.players)room.members.get(ball.id).ball=ball;
  room.snapshot(true);return frame;
}

// Stop at the exact authority tick that releases the ball, before friction or
// another tick changes the initial launch velocity and ground contact.
export async function finishMegRelease(room,members){
 let frame;
 for(let tick=0;tick<90;tick++){
  frame=await room.physics.step(1);
  room.worldTime=frame.time;room.mascots=frame.mascots;
  for(const ball of frame.players)room.members.get(ball.id).ball=ball;
  room.snapshot(true);
  if(members.every(m=>frame.players.find(p=>p.id===m.id).captureKind!==6))return frame;
 }
 throw Error('Meg did not complete the explicitly authorized ground release');
}
