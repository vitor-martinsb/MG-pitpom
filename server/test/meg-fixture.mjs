import assert from 'node:assert/strict';

// A real shot on the unmodified third map reaches Meg. No teleport or test-only
// worker command is used; this also exercises the actual capture collision.
export async function captureMeg(room,members){
  const physics=room.physics;
  const initial=await physics.step(0),meg=initial.mascots.wildlife[4];
  assert.equal(initial.mascots.thirdKind,4);assert.ok(meg.active);
  for(const member of members){
    const ball=initial.players.find(p=>p.id===member.id),dx=meg.pos[0]-ball.pos[0],dz=meg.pos[2]-ball.pos[2],length=Math.hypot(dx,dz);
    await room.shot(member,{sequence:1,direction:[dx/length,0,dz/length],power:.15});
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
