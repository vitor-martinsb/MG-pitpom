// Manual real-clock benchmark: node --import tsx test/bot-latency.mts
// Uses the existing authoritative Room and native planner, without mock shots.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Room,defaults} from '../src/room.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'out/bot-latency');fs.mkdirSync(output,{recursive:true});
Object.assign(process.env,{GOLF_CPU_BUDGET:'.1',GOLF_BOT_CPU_FRACTION:'.04',GOLF_BOT_SEARCH_MS:'4'});
const summarize=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {n:sorted.length,p50:sorted[Math.floor(sorted.length*.5)]??null,p95:sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]??null,max:sorted.at(-1)??null};};
const results:any[]=[];
const at=process.argv.indexOf('--bots'),selected=at>=0?Number(process.argv[at+1]):undefined;
if(selected!==undefined&&(!Number.isInteger(selected)||selected<1||selected>49))throw Error('--bots must be an integer from 1 to 49');
const scenarios=selected===undefined?[[1,30],[10,30],[30,120]]:[[selected,120]];
const levelAt=process.argv.indexOf('--level'),selectedLevel=levelAt>=0?process.argv[levelAt+1]:'data/campaign/family-04-3.level';
if(!selectedLevel||!fs.existsSync(path.join(root,selectedLevel)))throw Error('--level must name an existing course');
for(const [count,seconds]of scenarios){
 const level=selectedLevel;
 const ws={readyState:1,bufferedAmount:0,send(){},close(){}} as any;
 const room=new Room('BENCH',root,[level],{...defaults,duration:seconds!*1000}),host=room.join(ws,'Observer','#ffffff',0);
 Object.defineProperty(room,'physicsSeed',{value:12345});
 const plans:any[]=[],shots:any[]=[],resting=new Map<number,number>(),waits:number[]=[],snapshots:number[]=[];
 let timer:ReturnType<typeof setInterval>|undefined,start=0;
 try{
  room.botSettings(host,'count',null,{count,difficulty:'medium'});
  const loading=performance.now();await room.start(host,1);const loadMs=performance.now()-loading;
  const physics=(room as any).physics,plan=physics.plan.bind(physics),shot=room.shot.bind(room),snapshot=(room as any).snapshot.bind(room);
  physics.plan=async(slot:number,difficulty:any,cpuShare?:number)=>{const began=performance.now();try{const p=await plan(slot,difficulty,cpuShare);plans.push({slot,ms:performance.now()-began,cpuMs:p.cpuMs,cpuShare:p.cpuShare,reused:!!p.reused,safe:p.safe,wait:p.wait,ok:p.ok});return p;}catch(e){plans.push({slot,ms:performance.now()-began,error:true});throw e;}};
  room.shot=async(member:any,input:any)=>{await shot(member,input);if(member.bot){const now=performance.now();shots.push({id:member.id,atMs:now-start,strokes:member.ball.strokes});const since=resting.get(member.id);if(since!==undefined)waits.push(now-since);resting.delete(member.id);}};
  (room as any).snapshot=(...args:any[])=>{snapshots.push(performance.now());return snapshot(...args);};
  start=performance.now();room.ready(host,0);
  const observe=()=>{const now=performance.now();for(const m of room.members.values())if(m.bot){if(m.ball&&!m.ball.moving&&!m.ball.hole&&!m.ball.captureUntil){if(!resting.has(m.id))resting.set(m.id,now);}else resting.delete(m.id);}};
  observe();timer=setInterval(()=>{observe();void room.tick();},1000/defaults.snapshotHz);
  while(room.phase!=='results'&&room.phase!=='finished'&&![...room.members.values()].filter(m=>m.bot).every(m=>m.ball?.hole)&&performance.now()-start<(seconds!+8)*1000)await new Promise(r=>setTimeout(r,100));
  clearInterval(timer);timer=undefined;
  const elapsedMs=performance.now()-start,bots=[...room.members.values()].filter(m=>m.bot);
  const firstShots=bots.map(m=>({id:m.id,firstShotMs:shots.find(s=>s.id===m.id)?.atMs??null,strokes:m.ball?.strokes??0,pos:m.ball?.pos,hole:!!m.ball?.hole,stillRestingMs:resting.has(m.id)?performance.now()-resting.get(m.id)!:0}));
  const result={count,difficulty:'medium',level,roundSeconds:seconds,loadMs,elapsedMs,phase:room.phase,worldSeconds:room.worldTime,simulationSpeed:room.simulationSpeed,shots:shots.length,botsFinished:bots.filter(m=>m.ball?.hole).length,botsNeverShot:firstShots.filter(m=>m.firstShotMs===null).length,planningMs:summarize(plans.map(p=>p.ms)),restToShotMs:summarize(waits),snapshotGapMs:summarize(snapshots.slice(1).map((v,i)=>v-snapshots[i]!)),plannerReuses:plans.filter(p=>p.reused).length,unsafePlans:plans.filter(p=>p.safe===false).length,metrics:{...room.metrics},firstShots,plans:[...plans],shotTimeline:[...shots]};
  results.push(result);fs.writeFileSync(path.join(output,`bots-${count}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,firstShots:undefined,plans:undefined,shotTimeline:undefined}));
 }finally{if(timer)clearInterval(timer);room.close();}
}
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({profile:{cpuBudget:.1,basePlannerCpuFraction:.04,searchCpuMs:4,adaptiveIdleReserve:.2},limitations:'Local machine, configured planner yielding; no actual Render cgroup quota. One idle connected human keeps simulation at 1x. Thirty-second scenarios are observation windows, not default full rounds. Observation stops early if all bots finish.',results},null,2));
