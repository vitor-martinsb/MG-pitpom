import { WebSocket } from 'ws';
import { createServer } from './index.js';
import { performance } from 'node:perf_hooks';

const args=process.argv.slice(2);
const option=(name:string,fallback:string)=>{const at=args.indexOf(name);return at<0?fallback:args[at+1] ?? fallback;};
const count=Number(option('--players','50'));
if(!Number.isInteger(count)||count<1||count>50)throw Error('--players must be 1..50');
const seconds=Number(option('--seconds','15'));
const external=args.includes('--url');
if(!external)process.env.GOLF_HOLE_SECONDS=String(seconds);
const app=external?undefined:createServer();
if(app)await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const address=app?.server.address();
const url=option('--url',`ws://127.0.0.1:${address&&typeof address!=='string'?address.port:3000}/ws`);
let code='',complete=false,shots=0,receivedBytes=0,messages=0;
const latencies:number[]=[],clients:WebSocket[]=[],start=performance.now(),cpu=process.cpuUsage();
let failure:Error|undefined;
async function bot(index:number){
  return new Promise<void>((resolve,reject)=>{
    const socket=new WebSocket(url);clients.push(socket);
    let id=0,sequence=0,hole=-1,playing=false,pending=false,lastShot=0;
    const ping=setInterval(()=>{if(socket.readyState===1)socket.send(JSON.stringify({type:'ping',sent:performance.now()}));},2000);
    socket.on('open',()=>socket.send(JSON.stringify({type:index?'join':'create',code,nickname:`Bot${index+1}`,color:'#'+((index*73991)%0xffffff).toString(16).padStart(6,'0'),avatar:index%8})));
    socket.on('message',data=>{
      receivedBytes+=Buffer.byteLength(data.toString());messages++;const m=JSON.parse(data.toString());
      if(m.type==='welcome'){id=m.id;code=m.code;resolve();}
      else if(m.type==='load'){hole=m.hole;pending=false;socket.send(JSON.stringify({type:'ready',hole}));}
      else if(m.type==='room'){playing=m.phase==='playing';if(m.phase==='finished')complete=true;}
      else if(m.type==='pong'){latencies.push(performance.now()-m.sent);}
      else if(m.type==='shot'){pending=false;shots++;}
      else if(m.type==='error'){pending=false;if(!id)reject(Error(m.message));}
      else if(m.type==='snapshot'&&playing){
        const ball=m.players.find((b:any)=>b.id===id);
        if(ball&&!ball.moving&&!ball.hole&&!pending&&performance.now()-lastShot>300){
          pending=true;lastShot=performance.now();
          const angle=(index%7-3)*.04;
          socket.send(JSON.stringify({type:'shot',sequence:++sequence,direction:[Math.sin(angle),0,-Math.cos(angle)],power:.25+(index%5)*.08}));
        }
      }
    });
    socket.on('error',reject);socket.on('close',()=>clearInterval(ping));
  });
}
try{
  for(let i=0;i<count;i++)await bot(i);
  clients[0]!.send(JSON.stringify({type:'start',holes:3}));
  const limit=performance.now()+(seconds+20)*3*1000;
  while(!complete&&performance.now()<limit)await new Promise(resolve=>setTimeout(resolve,100));
  if(!complete)throw Error('Match did not finish within load-test timeout');
}catch(e){failure=e instanceof Error?e:Error(String(e));}
finally{
  const elapsed=(performance.now()-start)/1000,usage=process.cpuUsage(cpu),memory=process.memoryUsage();
  const metrics=app?[...app.rooms.values()][0]?.metrics:undefined;
  latencies.sort((a,b)=>a-b);
  console.log(JSON.stringify({players:count,completed:complete,elapsedSeconds:+elapsed.toFixed(2),acceptedShots:shots,
    serverAndBotsCpuPercent:+((usage.user+usage.system)/elapsed/10000).toFixed(2),rssMB:+(memory.rss/1048576).toFixed(2),
    physicsCpuPercent:metrics?+(metrics.physicsCpuMs/elapsed/10).toFixed(2):null,
    combinedCpuPercent:metrics?+(((usage.user+usage.system)/1000+metrics.physicsCpuMs)/elapsed/10).toFixed(2):null,
    messagesReceived:messages,totalReceivedMB:+(receivedBytes/1048576).toFixed(2),aggregateKBps:+(receivedBytes/elapsed/1024).toFixed(2),
    latencyP50ms:latencies[Math.floor(latencies.length*.5)]??null,latencyP95ms:latencies[Math.floor(latencies.length*.95)]??null,server:metrics},null,2));
  for(const socket of clients)socket.close();app?.close();
}
if(failure){console.error(failure);process.exitCode=1;}
