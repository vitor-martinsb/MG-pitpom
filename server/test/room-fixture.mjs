import {setTimeout as delay} from 'node:timers/promises';

// Freeze between real ticks. An in-flight tick resets busy in its finally
// block, so setting busy while that tick is running does not freeze the room.
export async function freezePhysics(room){
  const deadline=performance.now()+10000;
  while(room.busy){
    if(performance.now()>deadline)throw Error('Room did not finish its current physics tick.');
    await delay(1);
  }
  room.busy=true;
  return room.physics.step(0);
}
