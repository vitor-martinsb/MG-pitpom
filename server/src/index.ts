import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { Room, defaults, type Member } from './room.js';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function createServer() {
  const rooms=new Map<string,Room>();
  const settings=JSON.parse(fs.readFileSync(path.join(root,'server/config.json'),'utf8'));
  const bounded=(value:unknown,min:number,max:number)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Configuração multiplayer fora dos limites.');return value;};
  const options={...defaults,
    duration:bounded(Number(process.env.GOLF_HOLE_SECONDS ?? settings.holeSeconds),.1,3600)*1000,
    grace:bounded(Number(process.env.GOLF_GRACE_SECONDS ?? settings.graceSeconds),0,30)*1000,
    loadingTimeout:bounded(settings.loadingTimeoutSeconds,1,60)*1000,
    resultsDuration:bounded(settings.resultsSeconds,0,30)*1000,
    reconnectTTL:bounded(settings.reconnectSeconds,1,300)*1000,
    penalty:bounded(settings.dnfPenalty,1,100),snapshotHz:bounded(settings.snapshotHz,10,20)};
  const config=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
  const levels=Array.from({length:config.num_levels},(_,i)=>config[`level${i+1}`]);
  const web=path.join(root,'out/web');
  const server=http.createServer((req,res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin'); res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if (req.url==='/favicon.ico') { res.writeHead(204).end(); return; }
    if (req.url==='/health') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ok:true,rooms:rooms.size})); return; }
    let pathname: string; try { pathname=decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    const file=path.resolve(web,pathname==='/'?'golf.html':'.'+pathname);
    if (file!==web && !file.startsWith(web+path.sep)) { res.writeHead(403).end(); return; }
    const mime: Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.wasm':'application/wasm','.css':'text/css'};
    fs.stat(file,(error,stat)=>{
      if (error || !stat.isFile()) { res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Arquivo Web ausente. Execute o build Emscripten; consulte README.md.'); return; }
      res.setHeader('Content-Type',mime[path.extname(file)] ?? 'application/octet-stream');
      if(path.extname(file)==='.wasm' && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && fs.existsSync(file+'.gz')) {
        res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');fs.createReadStream(file+'.gz').pipe(res);
      }else fs.createReadStream(file).pipe(res);
    });
  });
  const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048,perMessageDeflate:false});
  const connections=new Set<WebSocket>();
  wss.on('connection',(socket,req)=>{
    try { if (req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) { socket.close(1008,'Origem inválida'); return; } }
    catch { socket.close(1008,'Origem inválida'); return; }
    if (connections.size>=500) { socket.close(1013,'Servidor cheio'); return; }
    connections.add(socket);
    let room:Room|undefined, member:Member|undefined, count=0, window=performance.now(), alive=true;
    let queue=Promise.resolve();
    socket.on('pong',()=>alive=true);
    const heartbeat=setInterval(()=>{ if (!alive) socket.terminate(); else {alive=false;socket.ping();} },15000);
    socket.on('message',(data,binary)=>{
      if (binary) { socket.close(1003,'Use JSON'); return; }
      if (performance.now()-window>1000) {window=performance.now();count=0;}
      if (++count>30) {socket.close(1008,'Limite de mensagens');return;}
      let message:any; try {message=JSON.parse(data.toString());if (!message || typeof message!=='object') throw Error();} catch {socket.close(1007,'JSON inválido');return;}
      queue=queue.then(async()=>{
        if (socket.readyState!==1) return;
        try {
          if (message.type==='ping') { socket.send(JSON.stringify({type:'pong',sent:message.sent})); return; }
          if (!member) {
            if (message.type==='create') {
              if (rooms.size>=100) throw Error('Limite de salas atingido.');
              let code=''; do {code=Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');} while(rooms.has(code));
              room=new Room(code,root,levels,options); member=room.join(socket,message.nickname,message.color,message.avatar); rooms.set(code,room);
            } else if (message.type==='join' || message.type==='reconnect') {
              room=rooms.get(String(message.code).toUpperCase()); if (!room) throw Error('Sala não encontrada.');
              member=message.type==='reconnect' ? await room.reconnect(socket,message.token) : room.join(socket,message.nickname,message.color,message.avatar);
            } else throw Error('Crie ou entre em uma sala.');
          } else if (message.type==='start') await room!.start(member,message.holes);
          else if (message.type==='ready') room!.ready(member,message.hole);
          else if (message.type==='shot') await room!.shot(member,message);
          else throw Error('Mensagem desconhecida.');
        } catch(error) { socket.send(JSON.stringify({type:'error',sequence:message.sequence,message:error instanceof Error?error.message:'Requisição inválida'})); }
      }).catch(console.error);
    });
    socket.on('error',()=>{});
    socket.on('close',()=>{clearInterval(heartbeat);connections.delete(socket);if(member && room) room.disconnect(member,socket);});
  });
  const tick=setInterval(()=>{for(const room of rooms.values()) void room.tick();},1000/options.snapshotHz);
  const cleanup=setInterval(()=>{for(const [code,room] of rooms) if (![...room.members.values()].some(m=>m.socket || m.disconnectedAt!==undefined && performance.now()-m.disconnectedAt<options.reconnectTTL)) {room.close();rooms.delete(code);}},10000);
  return {server,rooms,close:()=>{clearInterval(tick);clearInterval(cleanup);for(const room of rooms.values())room.close();wss.close();server.close();}};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=createServer(), port=Number(process.env.PORT ?? 3000);
  app.server.listen(port, '0.0.0.0',()=>console.log(`PitPom Minigolfe: http://localhost:${port}`));
  process.on('SIGINT',()=>{app.close();process.exit(0);}); process.on('SIGTERM',()=>{app.close();process.exit(0);});
}
