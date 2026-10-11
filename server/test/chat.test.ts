import test from 'node:test';
import assert from 'node:assert/strict';
import type { WebSocket as Socket } from 'ws';
import { WebSocket } from 'ws';
import { Room } from '../src/room.js';
import { createServer } from '../src/index.js';

function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(data:string)=>messages.push(JSON.parse(data)),close:()=>{},messages} as unknown as Socket & {messages:any[]};}
test('chat validates messages, limits frequency/history and preserves sender identity on reconnect',async()=>{
  let now=0;const room=new Room('CHAT1','',[],undefined,()=>now);
  const a=socket(),b=socket(),host=room.join(a,'Host','#ff0000',0);
  try {
    for(const invalid of ['', '  ', 42, 'x'.repeat(241), 'line\nbreak'])assert.throws(()=>room.chat(host,invalid));
    room.chat(host,' Olá ⛳ ');assert.equal(room.chatHistory[0]!.text,'Olá ⛳');
    assert.equal(room.chatHistory[0]!.nickname,'Host');assert.equal(room.chatHistory[0]!.playerId,host.id);
    assert.throws(()=>room.chat(host,'Flood'),/segundo/);
    room.join(b,'Guest','#00ff00',0);
    assert.equal(b.messages.find(m=>m.type==='chat-history').messages.length,1);
    for(let i=0;i<55;i++){now+=1001;room.chat(host,`Message ${i}`);}
    assert.equal(room.chatHistory.length,50);assert.equal(room.chatHistory[49]!.text,'Message 54');
    room.disconnect(host,a);assert.throws(()=>room.chat(host,'Offline'),/Entre/);
    const again=socket();await room.reconnect(again,host.token);
    assert.equal(again.messages.find(m=>m.type==='chat-history').messages.length,50);
    assert.throws(()=>room.chat(host,'Cooldown persists'),/segundo/);
  } finally {room.close();}
});

test('WebSocket chat is delivered only in its room, with server-owned identity',async()=>{
  const app=createServer(),sockets:WebSocket[]=[];
  await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}/ws`;
  async function connect(){
    const ws=new WebSocket(url),messages:any[]=[];sockets.push(ws);
    ws.on('message',data=>messages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    const wait=async(type:string)=>{for(let i=0;i<100;i++){const found=messages.find(m=>m.type===type);if(found)return found;await new Promise(resolve=>setTimeout(resolve,10));}throw Error(`Missing ${type}`);};
    return {ws,messages,wait};
  }
  try {
    const a=await connect();a.ws.send(JSON.stringify({type:'create',nickname:'Alice',color:'#ff0000',avatar:0}));
    const welcome=await a.wait('welcome');
    const b=await connect();b.ws.send(JSON.stringify({type:'join',code:welcome.code,nickname:'Bob',color:'#00ff00',avatar:0}));await b.wait('welcome');
    const c=await connect();c.ws.send(JSON.stringify({type:'create',nickname:'OtherRoom',color:'#0000ff',avatar:0}));await c.wait('welcome');
    a.ws.send(JSON.stringify({type:'chat',text:'Olá amigos!',nickname:'Forged',playerId:999}));
    const message=await b.wait('chat');assert.equal(message.nickname,'Alice');assert.equal(message.playerId,welcome.id);assert.equal(message.text,'Olá amigos!');
    await a.wait('chat');await new Promise(resolve=>setTimeout(resolve,100));assert.equal(c.messages.some(m=>m.type==='chat'),false);
    a.ws.send(JSON.stringify({type:'chat',text:'Flood'}));assert.equal((await a.wait('error')).scope,'chat');
  } finally {for(const ws of sockets)ws.terminate();app.close();}
});
