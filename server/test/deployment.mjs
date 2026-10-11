import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
const argument=process.argv.indexOf('--url');
const url=argument<0?'http://localhost:3000':process.argv[argument+1];
const sockets=[];
async function client(){
  const socket=new WebSocket(url.replace(/^http/,'ws')+'/ws',{origin:url});sockets.push(socket);
  const messages=[];socket.on('message',data=>messages.push(JSON.parse(data)));
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  return {socket,messages,send:message=>socket.send(JSON.stringify(message)),
    async wait(predicate){const end=Date.now()+20000;while(Date.now()<end){const found=messages.find(predicate);if(found)return found;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Protocol timeout');}};
}
try{
  const health=await fetch(url+'/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
  const page=await fetch(url);const html=await page.text();assert.match(html,/<html\b[^>]*\blang=(?:"en"|'en'|en)(?:\s|>)/);
  assert.equal(page.headers.get('cross-origin-opener-policy'),'same-origin');assert.equal(page.headers.get('cross-origin-embedder-policy'),'require-corp');
  for(const name of ['golf.js','golf.wasm','multiplayer.js','multiplayer.css','music.js','i18n.js','i18n-data.js']){
    const response=await fetch(url+'/'+name);assert.equal(response.status,200,name);const data=await response.arrayBuffer();assert.ok(data.byteLength>100,name);
    if(name==='golf.wasm')assert.equal(response.headers.get('content-type'),'application/wasm');
    if(name==='i18n-data.js')for(const text of ['English','Português','Español'])assert.ok(html.includes(text));
  }
  if(html.includes('src="art/pit-and-pom.png"')){
    const illustration=await fetch(url+'/art/pit-and-pom.png');assert.equal(illustration.status,200);
    assert.equal(illustration.headers.get('content-type'),'image/png');
    assert.deepEqual([...new Uint8Array(await illustration.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  }
  const host=await client();host.send({type:'create',nickname:'DeployHost',color:'#ffffff',avatar:0});const welcome=await host.wait(m=>m.type==='welcome');
  const guest=await client();guest.send({type:'join',code:welcome.code,nickname:'DeployGuest',color:'#ff0000',avatar:1});await guest.wait(m=>m.type==='welcome');
  host.send({type:'chat',text:'Olá · ¡Hola! · Hello'});await guest.wait(m=>m.type==='chat'&&m.text.includes('¡Hola!'));
  guest.send({type:'chat',text:''});const error=await guest.wait(m=>m.type==='error');assert.equal(error.code,'INVALID_CHAT');assert.equal(error.scope,'chat');assert.ok(error.message);
  host.send({type:'start',holes:3});await host.wait(m=>m.type==='load');await guest.wait(m=>m.type==='load');
  host.send({type:'ready',hole:0});guest.send({type:'ready',hole:0});await host.wait(m=>m.type==='room'&&m.phase==='playing');
  await host.wait(m=>m.type==='snapshot'&&m.players.length===2);
  host.send({type:'shot',sequence:1,direction:[0,0,-1],power:.2});assert.equal((await host.wait(m=>m.type==='shot')).accepted,true);
  host.socket.close();await new Promise(resolve=>host.socket.once('close',resolve));await new Promise(resolve=>setTimeout(resolve,100));
  const again=await client();again.send({type:'reconnect',code:welcome.code,token:welcome.token});assert.equal((await again.wait(m=>m.type==='welcome')).id,welcome.id);
  assert.ok((await again.wait(m=>m.type==='chat-history')).messages.some(m=>m.text.includes('¡Hola!')));
  console.log('Deployment: WebAssembly assets, headers, language resources, chat, stable error codes, native physics shot and reconnect passed.');
}finally{for(const socket of sockets)socket.terminate();}
