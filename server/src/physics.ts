import {loadingBudget} from './resources.js';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {setPriority,constants} from 'node:os';

export type WildAnimal={kind:number;active:boolean;visible?:boolean;pos:number[];forward:number[];walking:boolean;clock:number;action:number;actionTime:number};
export type Ball = { id: number; pos: number[]; vel: number[]; moving: boolean; hole: boolean; water: boolean; strokes: number; firstComplete: boolean; captured: boolean; captureUntil: number; slowUntil?:number; slowShots?:number; mudShots?:number; mudFadeUntil?:number; captureKind?:number; effectKind?:number; effectTime?:number; effectSerial?:number; wildlifeProtection?:number; rescueStarted?:number; rescueFrom?:number[] };
export type Mascots = { enabled: boolean; catActive?:boolean;dogActive?:boolean;catVisible?:boolean;dogVisible?:boolean;thirdKind?:number; cat: number[]; dog: number[]; slapTime: number; wakeTime: number; acceptedShots?:number;puddles?:{id:number;pos:number[];born:number;remaining:number}[];world?:number; stage?:number; course?:number; wildlife?:WildAnimal[] };
export type SoundEvent={id:number;player:number;kind:string;strength:number};
export type BotDifficulty='easy'|'medium'|'hard'|'expert';
export type Frame = { time: number; players: Ball[]; mascots: Mascots; events:SoundEvent[]; cpuMs: number; rssBytes: number; memoryBytes: number };
export class Physics {
  private child: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private closed = false;
  private planner?: Physics;
  private prepared?: Promise<void>;
  private configuration?: Record<string,unknown>;
  private planning = false;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  readonly ready: Promise<void>;
  constructor(private readonly root: string, private readonly level: string, private readonly isPlanner=false) {
    const executable = process.env.GOLF_PHYSICS_WORKER ?? [
      path.join(root, 'out/server-native/golf_physics_worker' + (process.platform === 'win32' ? '.exe' : '')),
      path.join(root, 'out/server-native/Release/golf_physics_worker.exe'),
    ].find(existsSync);
    if (!executable) throw new Error('Compile a física primeiro: npm run build:native');
    this.child = spawn(executable, [level,...(isPlanner?['--planner']:[])], { cwd: root, windowsHide: true, stdio: 'pipe' });
    // The match must keep its CPU share while the optional planner searches.
    if(isPlanner)this.child.once('spawn',()=>{try{setPriority(this.child.pid!,constants.priority.PRIORITY_BELOW_NORMAL);}catch{/* Some hosts disallow changing process priority. */}});
    let resolveReady!: () => void, rejectReady!: (e: Error) => void;
    this.ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const startup = setTimeout(() => { rejectReady(new Error('Physics loading timed out')); this.close(); }, loadingBudget()||10000);
    this.child.stderr.on('data', data => process.stderr.write(data));
    createInterface({ input: this.child.stdout }).on('line', line => {
      try {
        const message = JSON.parse(line);
        if (message.type === 'ready') { clearTimeout(startup); resolveReady(); return; }
        const request = this.pending.get(message.request);
        if (request) { this.pending.delete(message.request); clearTimeout(request.timer); request.resolve(message); }
      } catch { this.close(); }
    });
    const failed = (error: Error) => {
      clearTimeout(startup); rejectReady(error);
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
      this.pending.clear();
    };
    this.child.on('error', failed);
    this.child.stdin.on('error', failed);
    this.child.stdout.on('error', failed);
    this.child.on('exit', code => failed(new Error(`Physics worker exited (${code})`)));
  }
  async command(message: Record<string, unknown>): Promise<any> {
    if(message.cmd==='configure')this.configuration={...message};
    await this.ready;
    if (this.closed || this.child.killed || this.child.exitCode !== null) throw new Error('Physics unavailable');
    const request = ++this.sequence;
    return new Promise((resolve, reject) => {
      // River forecasts can take longer on a small CPU. Only graph/search work
      // gets this budget; live physics and snapshots keep their short deadline.
      const timer = setTimeout(() => { this.pending.delete(request); reject(new Error('Physics request timed out')); this.close(); }, message.cmd==='prepareBots'?(loadingBudget()||30000):message.cmd==='plan'?(loadingBudget()?300000:30000):5000);
      this.pending.set(request, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ ...message, request }) + '\n');
    });
  }
  add(slot: number, id: number) { return this.command({ cmd: 'add', slot, id }); }
  configure(impact: boolean, seed: number, forwardProbability=.5,previousPet=-1) {
    this.configuration={cmd:'configure',impact,mascots:true,seed,forwardProbability,previousPet};
    return this.command(this.configuration);
  }
  connected(slot: number, connected: boolean) { return this.command({ cmd: 'connected', slot, connected }); }
  async shot(slot: number, direction: number[], power: number): Promise<boolean> { return (await this.command({ cmd: 'shot', slot, direction, power })).ok; }
  async step(ticks: number): Promise<Frame> { return this.command({ cmd: 'step', ticks }); }
  async plan(slot:number,difficulty:BotDifficulty){
    if(this.planning)throw new Error('Bot planner already busy');
    this.planning=true;
    try{
      await this.prepareBots();
      const planner=this.planner!;
      const snapshot=await this.command({cmd:'plannerState',slot});
      if(!snapshot.ok)return {ok:false};
      if(!(await planner.command({cmd:'restorePlanner',state:snapshot.state})).ok)throw new Error('Invalid planner snapshot');
      return {...await planner.command({cmd:'plan',slot,difficulty}),sampledAt:snapshot.time};
    }catch(error){
      this.planner?.close();this.planner=undefined;this.prepared=undefined;
      throw error;
    }finally{this.planning=false;}
  }
  async prepareBots():Promise<void>{
    if(this.isPlanner){await this.command({cmd:'prepareBots'});return;}
    if(!this.prepared)this.prepared=this.startPlanner();
    return this.prepared;
  }
  private async startPlanner(){
    if(this.closed)throw new Error('Physics unavailable');
    const planner=new Physics(this.root,this.level,true);this.planner=planner;
    try{
      await planner.ready;
      if(this.closed)throw new Error('Physics unavailable');
      if(this.configuration)await planner.command(this.configuration);
      await planner.command({cmd:'prepareBots'});
    }catch(error){planner.close();if(this.planner===planner){this.planner=undefined;this.prepared=undefined;}throw error;}
  }
  close() { this.closed=true;this.planner?.close();this.child.kill(); }
}
