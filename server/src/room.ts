import { randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import { Physics, type Ball, type Mascots, type SoundEvent, type BotDifficulty } from './physics.js';

export type Phase = 'lobby' | 'loading' | 'playing' | 'settling' | 'results' | 'finished';
export type Member = {
  id: number; slot: number; nickname: string; color: string; avatar: number; token: string;
  socket?: WebSocket; ready: boolean; lastSequence: number; scores: number[]; dnf: boolean[];
  disconnectedAt?: number; ball?: Ball;
  lastChatAt?: number;
  bot?: BotDifficulty; nextDecision?: number; planRetries?:number;
};
export type ChatMessage = { type: 'chat'; id: number; playerId: number; nickname: string; color: string; text: string; sentAt: number };
export type RoomOptions = { duration: number; grace: number; loadingTimeout: number; resultsDuration: number; penalty: number; reconnectTTL: number; snapshotHz: number; catForwardProbability: number };
export const defaults: RoomOptions = { duration: 120000, grace: 5000, loadingTimeout: 10000, resultsDuration: 5000, penalty: 12, reconnectTTL: 60000, snapshotHz: 15, catForwardProbability: .5 };
export const BOT_STROKE_LIMIT=48;
const botNames=['GPT-6','Claude','Gemini','DeepSeek','Llama','Mistral','Qwen','Grok','Gemma','Phi','Command R','Falcon','Yi','Mixtral','Kimi'];
export class Room {
  readonly members = new Map<number, Member>();
  phase: Phase = 'lobby';
  host = 0;
  hole = 0;
  holes = 3;
  deadline = 0;
  worldTime = 0;
  simulationSpeed=1;
  mode: 'classic' | 'impact' = 'classic';
  selectedLevels: number[] = [];
  mapPool:number[]=[];
  mapPoolKind:'all'|'originals'|'evolutions'|'custom'='all';
  match=0;
  mascots?: Mascots;
  readonly physicsSeed = randomBytes(4).readUInt32LE();
  private nextId = 1;
  private physics?: Physics;
  private busy = false;
  private loading = false;
  private lastStep = 0;
  private accumulated = 0;
  private frameNumber = 0;
  private lastSent = new Map<number, string>();
  private closed = false;
  private chatSequence = 0;
  readonly chatHistory: ChatMessage[] = [];
  private lastPhysicsCpu = 0;
  private generation = 0;
  private botCursor = 0;
  private events:SoundEvent[]=[];
  readonly metrics = { physicsTicks: 0, snapshots: 0, bytes: 0, messages: 0, maxTickMs: 0, physicsCpuMs: 0, physicsPeakRssBytes: 0, physicsPeakTrackedBytes: 0 };
  readonly validLevels:number[];
  constructor(readonly code: string, readonly root: string, readonly levels: string[], readonly options: RoomOptions = defaults, readonly now = () => performance.now()) {
    this.options={...options,penalty:12};
    const seen=new Set<string>();this.validLevels=levels.flatMap((file,index)=>{
      try{if(seen.has(file))return [];seen.add(file);const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));return Array.isArray(data.entities)&&data.entities.some((e:any)=>e.type==='ball-start')&&data.entities.some((e:any)=>e.type==='hole')?[index]:[];}catch{return [];}
    });
    this.holes=Math.min(3,this.validLevels.length);
    this.mapPool=[...this.validLevels];
  }
  send(member: Member, message: unknown) {
    if (member.socket?.readyState === 1) {
      const text = JSON.stringify(message);
      if (member.socket.bufferedAmount > 1024 * 1024) { member.socket.close(1013, 'Conexão lenta'); return; }
      member.socket.send(text); this.metrics.bytes += Buffer.byteLength(text); this.metrics.messages++;
    }
  }
  broadcast(message: unknown) { for (const member of this.members.values()) this.send(member, message); }
  state() {
    return { type: 'room', code: this.code, phase: this.phase, host: this.host, hole: this.hole, holes: this.holes, penalty: this.options.penalty,
      level: this.selectedLevels[this.hole] ?? this.hole, remaining: Math.max(0, this.deadline - this.now()), worldTime: this.worldTime, mode: this.mode,
      sequence:this.selectedLevels, availableMaps:this.validLevels.length,mapPool:this.mapPool,mapPoolKind:this.mapPoolKind,match:this.match,completed:this.phase==='finished'&&this.hole>=this.holes,simulationSpeed:this.simulationSpeed,
      players: [...this.members.values()].map(m => ({ id: m.id, nickname: m.nickname, color: m.color, avatar: m.avatar,
        connected: !!m.socket || !!m.bot, bot:m.bot, ready: m.ready, scores: m.scores, dnf: m.dnf, total: m.scores.reduce((a,b) => a+b,0) })) };
  }
  publish() { this.broadcast(this.state()); }
  join(socket: WebSocket, nickname: unknown, color: unknown, avatar: unknown): Member {
    if (this.phase !== 'lobby') throw new Error('Partida já começou. Aguarde uma nova sala.');
    if (this.members.size >= 50) throw new Error('Sala cheia (50 jogadores).');
    if (typeof nickname !== 'string' || !/^[\x20-\x7e]{1,24}$/.test(nickname.trim())) throw new Error('Use um nickname ASCII de 1 a 24 caracteres.');
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Cor inválida.');
    if (!Number.isInteger(avatar) || (avatar as number)<0 || (avatar as number)>7) throw new Error('Avatar inválido.');
    const occupied = new Set([...this.members.values()].map(m=>m.slot)); let slot=0; while (occupied.has(slot)) slot++;
    const id=this.nextId++;
    const m: Member={ id,slot,nickname:nickname.trim(),color,avatar:avatar as number,token:randomBytes(24).toString('hex'),socket,ready:false,lastSequence:0,scores:[],dnf:[] };
    this.members.set(id,m); if (!this.host) this.host=id;
    for(const bot of this.members.values())if(bot.bot&&bot.nickname.toLowerCase()===m.nickname.toLowerCase())bot.nickname=this.nextBotName();
    this.send(m,{ type:'welcome',id,token:m.token,code:this.code });
    this.send(m,{type:'chat-history',messages:this.chatHistory}); this.publish(); return m;
  }
  async reconnect(socket: WebSocket, token: unknown): Promise<Member> {
    const m=[...this.members.values()].find(m=> typeof token==='string' && m.token===token);
    if (!m || m.bot || (m.disconnectedAt !== undefined && this.now()-m.disconnectedAt>this.options.reconnectTTL)) throw new Error('Reconexão expirada.');
    if (m.socket) throw new Error('Jogador já conectado.');
    m.socket=socket; m.disconnectedAt=undefined; m.ready=false;
    if (!this.host) this.host=m.id;
    if (this.physics) await this.physics.connected(m.slot,true);
    this.send(m,{type:'welcome',id:m.id,token:m.token,code:this.code,sequence:m.lastSequence});
    this.send(m,{type:'chat-history',messages:this.chatHistory});
    this.send(m,this.state());
    if (this.phase!=='lobby'&&this.phase!=='finished') this.send(m,{type:'load',level:this.selectedLevels[Math.min(this.hole,this.holes-1)] ?? Math.min(this.hole,this.holes-1),hole:this.hole});
    this.publish(); return m;
  }
  disconnect(m: Member, socket: WebSocket) {
    if (m.socket!==socket) return;
    m.socket=undefined; m.ready=false; m.disconnectedAt=this.now();
    const physics=this.physics;
    void physics?.connected(m.slot,false).catch(e=>{if(this.physics===physics)this.fail(e);});
    if (m.id===this.host) this.host=[...this.members.values()].filter(p=>p.socket&&!p.bot).sort((a,b)=>a.id-b.id)[0]?.id ?? 0;
    this.publish();
  }
  async start(m: Member, holes: unknown, mode: unknown = 'classic') {
    this.configure(m,holes,mode);
    this.selectedLevels=[...this.mapPool];
    for(let i=this.selectedLevels.length-1;i>0;i--){const j=randomInt(i+1);[this.selectedLevels[i],this.selectedLevels[j]]=[this.selectedLevels[j]!,this.selectedLevels[i]!];}
    this.selectedLevels.length=this.holes;
    this.match++;
    this.hole=0;for(const p of this.members.values()){p.scores=[];p.dnf=[];} await this.load();
  }
  private hostOnly(m:Member){if(this.members.get(m.id)!==m||m.id!==this.host||!m.socket||m.bot||this.phase!=='lobby')throw Error('Somente o anfitrião pode configurar no lobby.');}
  rematch(m:Member){
    if(this.members.get(m.id)!==m||m.id!==this.host||!m.socket||m.bot||this.phase!=='finished')throw Error('Somente o anfitrião pode reiniciar após os resultados.');
    this.generation++;this.physics?.close();this.physics=undefined;this.phase='lobby';this.hole=0;this.deadline=0;this.selectedLevels=[];this.events=[];
    for(const p of this.members.values()){p.scores=[];p.dnf=[];p.ball=undefined;p.ready=!!p.bot;}this.publish();
  }
  configure(m:Member,holes:unknown=this.holes,mode:unknown=this.mode){
    this.hostOnly(m);
    if(!Number.isInteger(holes)||(holes as number)<1||(holes as number)>this.mapPool.length)throw Error('Quantidade de mapas inválida.');
    if(mode!=='classic'&&mode!=='impact')throw Error('Modo de jogo inválido.');
    this.holes=holes as number;this.mode=mode;this.publish();
  }
  configurePool(m:Member,kind:unknown,ids:unknown){
    this.hostOnly(m);
    if(!['all','originals','evolutions','custom'].includes(kind as string))throw Error('Quantidade de mapas inválida.');
    const pool=kind==='custom'?ids:this.validLevels.filter(i=>kind==='all'||(kind==='originals'?this.levels[i]!.startsWith('data/levels/'):this.levels[i]!.startsWith('data/campaign/')));
    if(!Array.isArray(pool)||!pool.length||pool.length>this.validLevels.length||new Set(pool).size!==pool.length||pool.some(i=>!Number.isInteger(i)||!this.validLevels.includes(i)))throw Error('Quantidade de mapas inválida.');
    this.mapPool=[...pool];this.mapPoolKind=kind as typeof this.mapPoolKind;this.holes=Math.min(this.holes,pool.length);this.publish();
  }
  private nextBotName(){
    const used=new Set([...this.members.values()].map(p=>p.nickname.toLowerCase()));
    for(let i=0;;i++){const name=botNames[i%botNames.length]!+(i>=botNames.length?` ${Math.floor(i/botNames.length)+1}`:'');if(!used.has(name.toLowerCase()))return name;}
  }
  private addBot(difficulty:BotDifficulty,nickname=this.nextBotName(),color='#d8a951'){
    const slots=new Set([...this.members.values()].map(p=>p.slot));let slot=0;while(slots.has(slot))slot++;
    const bot:Member={id:this.nextId++,slot,nickname,color,avatar:0,token:'',ready:true,lastSequence:0,scores:[],dnf:[],bot:difficulty};this.members.set(bot.id,bot);return bot;
  }
  botSettings(m:Member,action:unknown,id:unknown,settings:any={}){
    this.hostOnly(m);
    if(!settings||typeof settings!=='object')throw Error('Configuração de bot inválida.');
    if(action==='count'){
      const humans=[...this.members.values()].filter(p=>!p.bot),bots=[...this.members.values()].filter(p=>p.bot);
      const count=settings.count,difficulty=settings.difficulty??'medium';
      if(!Number.isInteger(count)||count<0||count>50-humans.length)throw Error('Quantidade de bots inválida.');
      if(!['easy','medium','hard','expert'].includes(difficulty))throw Error('Configuração de bot inválida.');
      for(const bot of bots.slice(count))this.members.delete(bot.id);
      for(const bot of bots.slice(0,count))bot.bot=difficulty;
      for(let i=bots.length;i<count;i++)this.addBot(difficulty);
      this.publish();return;
    }
    if(action==='remove'){const bot=this.members.get(id as number);if(!bot?.bot)throw Error('Bot não encontrado.');this.members.delete(bot.id);this.publish();return;}
    if(action!=='add'&&action!=='update')throw Error('Configuração de bot inválida.');
    let bot=action==='update'?this.members.get(id as number):undefined;
    if(action==='update'&&!bot?.bot)throw Error('Bot não encontrado.');
    const difficulty=settings.difficulty ?? bot?.bot ?? 'medium';
    const nickname=settings.nickname ?? bot?.nickname ?? this.nextBotName();
    const color=settings.color ?? bot?.color ?? '#d8a951';
    if(!['easy','medium','hard','expert'].includes(difficulty)||typeof nickname!=='string'||!/^[\x20-\x7e]{1,24}$/.test(nickname.trim())||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw Error('Configuração de bot inválida.');
    if([...this.members.values()].some(p=>p.id!==bot?.id&&p.nickname.toLowerCase()===nickname.trim().toLowerCase()))throw Error('Nome de bot já utilizado.');
    if(!bot){
      if(this.members.size>=50)throw Error('Sala cheia (50 jogadores).');
      bot=this.addBot(difficulty,nickname,color);
    }
    bot.nickname=nickname.trim();bot.color=color;bot.bot=difficulty;this.publish();
  }
  private async load() {
    const generation=++this.generation;
    this.phase='loading'; this.loading=true; this.deadline=0; this.worldTime=0;this.lastPhysicsCpu=0;this.events=[];this.simulationSpeed=1;
    for (const m of this.members.values()) { m.ready=!!m.bot; m.ball=undefined;m.nextDecision=0;m.planRetries=0; }
    this.lastSent.clear(); this.physics?.close();
    const level=this.selectedLevels[this.hole] ?? this.hole;
    this.publish(); this.broadcast({type:'load',level,hole:this.hole});
    const physics=this.physics=new Physics(this.root,this.levels[level]!);
    const current=()=>!this.closed&&generation===this.generation&&physics===this.physics;
    try {
      await physics.ready;if(!current())return;
      await physics.configure(this.mode==='impact',(this.physicsSeed ^ this.hole) >>> 0,this.options.catForwardProbability);if(!current())return;
      for (const m of this.members.values()) { await physics.add(m.slot,m.id);if(!current())return; if (!m.socket&&!m.bot) await physics.connected(m.slot,false);if(!current())return; }
      this.loading=false; this.deadline=this.now()+this.options.loadingTimeout; this.lastStep=this.now(); this.accumulated=0;
      const frame=await physics.step(0);if(!current())return; this.mascots=frame.mascots; for (const b of frame.players) this.members.get(b.id)!.ball=b;
      this.snapshot(true); this.publish(); this.maybeBegin();
    } catch(e) { if(current())this.fail(e); }
  }
  ready(m: Member, hole: unknown) {
    if (hole!==this.hole || this.phase==='lobby') return;
    m.ready=true; this.publish(); this.snapshot(true,m); this.maybeBegin();
  }
  private maybeBegin() {
    if (this.phase!=='loading' || this.loading) return;
    const connected=[...this.members.values()].filter(m=>m.socket);
    if (connected.length && connected.every(m=>m.ready)) this.begin();
  }
  private begin() { this.phase='playing'; this.deadline=this.now()+this.options.duration; this.lastStep=this.now(); this.publish(); }
  async shot(m: Member, message: any) {
    const seq=message.sequence;
    if (!Number.isSafeInteger(seq) || seq<=m.lastSequence) throw new Error('Tacada duplicada ou fora de ordem.');
    m.lastSequence=seq;
    if (this.phase!=='playing' || this.now()>=this.deadline || (!m.socket&&!m.bot) || !m.ready || m.ball?.moving || m.ball?.hole || m.ball?.captureUntil || (m.bot&&(m.ball?.strokes??0)>=BOT_STROKE_LIMIT)) throw new Error('Tacada indisponível.');
    const d=message.direction, power=message.power;
    if (!Array.isArray(d) || d.length!==3 || d.some(v=>typeof v!=='number' || !Number.isFinite(v) || Math.abs(v)>1) || Math.abs(d[1])>.001 || Math.hypot(d[0],d[2])<.001 || typeof power!=='number' || !Number.isFinite(power) || power<0 || power>1) throw new Error('Direção ou potência inválida.');
    if (!this.physics || !await this.physics.shot(m.slot,d,power)) throw new Error('Bola ainda em movimento.');
    if (m.ball) { m.ball.moving=true; m.ball.strokes++; }
    this.send(m,{type:'shot',sequence:seq,accepted:true});
  }
  chat(m: Member, text: unknown) {
    if (this.members.get(m.id)!==m || !m.socket) throw new Error('Entre na sala para conversar.');
    if (typeof text!=='string' || !text.trim() || text.length>240 || /[\u0000-\u001f\u007f]/.test(text))
      throw new Error('Envie uma mensagem de 1 a 240 caracteres em uma linha.');
    const now=this.now();
    if (m.lastChatAt!==undefined && now-m.lastChatAt<1000) throw new Error('Aguarde um segundo entre mensagens.');
    m.lastChatAt=now;
    const message: ChatMessage={type:'chat',id:++this.chatSequence,playerId:m.id,nickname:m.nickname,color:m.color,text:text.trim(),sentAt:Date.now()};
    this.chatHistory.push(message);
    if (this.chatHistory.length>50) this.chatHistory.shift();
    this.broadcast(message);
  }
  async tick() {
    if (this.busy) return;
    const now=this.now();
    if (this.phase==='lobby') {
      let changed=false;
      for (const m of this.members.values()) if (!m.socket && m.disconnectedAt!==undefined && now-m.disconnectedAt>this.options.reconnectTTL) {this.members.delete(m.id);changed=true;}
      if(changed)this.publish();
      return;
    }
    if (this.phase==='loading') { if (!this.loading && now>=this.deadline) this.begin(); return; }
    if (this.phase==='results') { if (now>=this.deadline) { if (++this.hole<this.holes) await this.load(); else { this.phase='finished'; this.physics?.close(); this.physics=undefined; this.publish(); } } return; }
    if (this.phase==='finished' || !this.physics) return;
    const humans=[...this.members.values()].filter(m=>!m.bot);
    const botsRemain=[...this.members.values()].some(m=>m.bot&&!m.ball?.hole&&(m.ball?.strokes??0)<BOT_STROKE_LIMIT);
    const speed=humans.length>0&&humans.every(m=>m.ball?.hole||m.dnf[this.hole]===true)&&botsRemain?5:1;
    const elapsed=Math.max(0,now-this.lastStep);
    if(this.phase==='playing'||this.phase==='settling')this.deadline-=elapsed*(speed-1);
    if(speed!==this.simulationSpeed){this.simulationSpeed=speed;this.publish();}
    if (this.phase==='playing' && now>=this.deadline) { this.phase='settling'; this.deadline+=this.options.grace; this.publish(); }
    this.busy=true;
    const physics=this.physics, generation=this.generation;
    try {
      this.accumulated+=elapsed*.12*speed; this.lastStep=now;
      const ticks=Math.min(speed===5?600:120,Math.floor(this.accumulated)); this.accumulated-=ticks;
      const started=performance.now(), frame=await physics.step(ticks);
      if(generation!==this.generation || physics!==this.physics)return;
      this.worldTime=frame.time; this.mascots=frame.mascots;this.events=frame.events; this.metrics.physicsTicks+=ticks; this.metrics.maxTickMs=Math.max(this.metrics.maxTickMs,performance.now()-started);
      this.metrics.physicsCpuMs+=Math.max(0,frame.cpuMs-this.lastPhysicsCpu);this.lastPhysicsCpu=frame.cpuMs;
      this.metrics.physicsPeakRssBytes=Math.max(this.metrics.physicsPeakRssBytes,frame.rssBytes);this.metrics.physicsPeakTrackedBytes=Math.max(this.metrics.physicsPeakTrackedBytes,frame.memoryBytes);
      for (const b of frame.players) this.members.get(b.id)!.ball=b;
      this.snapshot(++this.frameNumber % (this.options.snapshotHz*2) === 0);
      const active=[...this.members.values()].filter(m=>m.socket||m.bot);
      if (active.length && active.every(m=>m.ball?.hole||(m.bot&&!m.ball?.moving&&(m.ball?.strokes??0)>=BOT_STROKE_LIMIT)) || this.phase==='settling' && now>=this.deadline) this.finishHole();
      else if(this.phase==='playing'){
        const clock=frame.time*1000;
        const bots=active.filter(m=>m.bot&&m.ready&&!m.ball?.moving&&!m.ball?.hole&&!m.ball?.captureUntil&&(m.ball?.strokes??0)<BOT_STROKE_LIMIT&&(m.nextDecision??0)<=clock);
        for(let i=0;i<(speed===5?3:1)&&bots.length;i++){
          const bot=bots.splice(this.botCursor++%bots.length,1)[0]!;bot.nextDecision=clock+650+((this.physicsSeed^bot.id^(bot.ball?.strokes??0)*197)>>>0)%500;
          const plan=await physics.plan(bot.slot,bot.bot!);
          if(plan.safe===false&&(bot.planRetries??0)<2){bot.planRetries=(bot.planRetries??0)+1;bot.nextDecision=clock+350;continue;}
          bot.planRetries=0;
          if(generation===this.generation&&this.phase==='playing'&&this.now()<this.deadline&&plan.ok)await this.shot(bot,{sequence:bot.lastSequence+1,direction:plan.direction,power:plan.power});
        }
      }
    } catch(e) { if(generation===this.generation && physics===this.physics)this.fail(e); }
    finally { this.busy=false; }
  }
  private finishHole() {
    if(this.phase==='results'||this.phase==='finished')return;
    for (const m of this.members.values()) {
      const finished=!!m.ball?.hole;
      m.scores[this.hole]=(m.ball?.strokes??0)+(finished?0:12);
      m.dnf[this.hole]=!finished;
    }
    this.phase='results'; this.deadline=this.now()+this.options.resultsDuration; this.publish();
  }
  private snapshot(full: boolean, target?: Member) {
    const players: Ball[]=[];
    for (const m of this.members.values()) if (m.ball) {
      const text=JSON.stringify(m.ball);
      if (full || this.lastSent.get(m.id)!==text) players.push(m.ball);
      if (!target) this.lastSent.set(m.id,text);
    }
    const snapshot={type:'snapshot',full,hole:this.hole,time:this.worldTime,remaining:Math.max(0,this.deadline-this.now()),simulationSpeed:this.simulationSpeed,mascots:this.mascots,players,events:target?[]:this.events};
    if (target) this.send(target,snapshot); else this.broadcast(snapshot);
    this.metrics.snapshots++;
  }
  fail(error: unknown) { if(this.closed)return;console.error(`[${this.code}]`,error); this.broadcast({type:'error',code:'PHYSICS_FAILED',message:'Falha na física. Crie uma nova sala.'}); this.phase='finished'; this.physics?.close(); this.physics=undefined; this.publish(); }
  close() { this.closed=true;this.physics?.close(); for (const m of this.members.values()) m.socket?.close(1001,'Servidor encerrado'); }
}
