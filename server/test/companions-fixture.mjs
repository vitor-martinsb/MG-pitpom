import assert from 'node:assert/strict';
export async function companionFrame(room,ticks=30){
 const f=await room.physics.step(ticks);room.worldTime=f.time;room.mascots=f.mascots;
 for(const b of f.players){const m=room.members.get(b.id);if(m)m.ball=b;}
 room.snapshot(true);return f;
}
// Real shot on an original field: Benedita's gaze, Smanata's chase and carry.
export async function captureSmanata(room,member,fire=(m,shot)=>room.shot(m,shot),stopOnCapture=false){
 const f=await companionFrame(room,0),s=f.mascots.companions.smanata,b=member.ball;
 assert.ok(s.active&&f.mascots.companions.benedita.active);
 const dx=s.pos[0]-b.pos[0],dz=s.pos[2]-b.pos[2],length=Math.hypot(dx,dz);
 await fire(member,{sequence:1,direction:[dx/length,0,dz/length],power:.22});
 let gazed=false;
 for(let tick=0;tick<100;tick++){
  const f=await companionFrame(room);gazed||=member.ball.captureKind===7;
  if(member.ball.captureKind===8&&(stopOnCapture||f.mascots.companions.smanata.state===3))return {frame:f,gazed};
 }
 throw Error('A real shot must reach Smanata and her safe destination.');
}
