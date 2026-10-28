import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Room} from '../src/room.js';
import {createServer} from '../src/index.js';
import {WebSocket} from 'ws';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const socket=()=>({readyState:1,bufferedAmount:0,send(){},close(){}} as unknown as WebSocket);
test('host and guest customize only themselves in the lobby; validation and room permissions remain authoritative',()=>{
 const r=new Room('STYLE',root,['data/levels/level-3.level']);
 try{
  const host=r.join(socket(),'Host','#ee6255',0),guest=r.join(socket(),'Guest','#ffffff',1);const before=r.state();
  r.updateProfile(guest,{id:host.id,nickname:'Guest2',color:'#00aaff',avatar:7});
  assert.equal(host.nickname,'Host');assert.equal(host.color,'#ee6255');assert.equal(guest.nickname,'Guest2');assert.equal(guest.avatar,7);
  assert.equal(r.host,host.id);assert.equal(r.holes,before.holes);assert.deepEqual(r.mapPool,before.mapPool);assert.equal(r.mode,before.mode);
  r.updateProfile(host,{color:'#ff00aa',avatar:4});assert.equal(host.avatar,4);assert.equal(guest.color,'#00aaff');
  assert.throws(()=>r.configure(guest,1,'impact'),/anfitrião/);assert.throws(()=>r.configurePool(guest,'custom',[0]),/anfitrião/);assert.throws(()=>r.botSettings(guest,'add',null),/anfitrião/);
  for(const invalid of [{color:'red'},{avatar:8},{nickname:''},{nickname:'inva\nlid'}])assert.throws(()=>r.updateProfile(guest,invalid));
  r.phase='playing';assert.throws(()=>r.updateProfile(host,{color:'#ffffff'}),/lobby/);r.phase='lobby';
  r.disconnect(guest,guest.socket!);assert.throws(()=>r.updateProfile(guest,{color:'#ffffff'}),/lobby/);
 }finally{r.close();}
});
test('WebSocket profile updates bind to the sender and publish to both clients',async()=>{
 const app=createServer();await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 const url=`ws://127.0.0.1:${(app.server.address() as any).port}/ws`,clients:WebSocket[]=[];
 const open=async()=>{const w=new WebSocket(url);clients.push(w);await new Promise(r=>w.once('open',r));const messages:any[]=[];w.on('message',b=>messages.push(JSON.parse(String(b))));return {w,messages};};
 const wait=async(p:()=>any)=>{for(let i=0;i<100;i++){const x=p();if(x)return x;await new Promise(r=>setTimeout(r,10));}throw Error('profile publication timed out');};
 try{
  const a=await open();a.w.send(JSON.stringify({type:'create',nickname:'Host',color:'#ffffff',avatar:0}));const welcome=await wait(()=>a.messages.find(m=>m.type==='welcome'));
  const b=await open();b.w.send(JSON.stringify({type:'join',code:welcome.code,nickname:'Guest',color:'#111111',avatar:1}));await wait(()=>b.messages.find(m=>m.type==='welcome'));
  b.w.send(JSON.stringify({type:'profile',id:welcome.id,nickname:'Guest2',color:'#33aa44',avatar:6}));
  for(const c of [a,b]){const state=await wait(()=>c.messages.find(m=>m.type==='room'&&m.players.some((p:any)=>p.nickname==='Guest2')));assert.equal(state.players.find((p:any)=>p.id===welcome.id).color,'#ffffff');assert.equal(state.players.find((p:any)=>p.nickname==='Guest2').avatar,6);}
 }finally{for(const c of clients)c.terminate();app.close();}
});
