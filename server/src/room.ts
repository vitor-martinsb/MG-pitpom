import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import { Physics, type Ball } from './physics.js';

export type Phase = 'lobby' | 'loading' | 'playing' | 'settling' | 'results' | 'finished';
export type Member = {
  id: number; slot: number; nickname: string; color: string; avatar: number; token: string;
  socket?: WebSocket; ready: boolean; lastSequence: number; scores: number[]; dnf: boolean[];
  disconnectedAt?: number; ball?: Ball;
};
export type RoomOptions = { duration: number; grace: number; loadingTimeout: number; resultsDuration: number; penalty: number; reconnectTTL: number; snapshotHz: number };
export const defaults: RoomOptions = { duration: 120000, grace: 5000, loadingTimeout: 10000, resultsDuration: 5000, penalty: 12, reconnectTTL: 60000, snapshotHz: 15 };
export class Room {
  readonly members = new Map<number, Member>();
  phase: Phase = 'lobby';
  host = 0;
  hole = 0;
  holes = 3;
  deadline = 0;
  worldTime = 0;
  private nextId = 1;
  private physics?: Physics;
  private busy = false;
  private loading = false;
  private lastStep = 0;
  private accumulated = 0;
  private frameNumber = 0;
  private lastSent = new Map<number, string>();
  private closed = false;
  private lastPhysicsCpu = 0;
  readonly metrics = { physicsTicks: 0, snapshots: 0, bytes: 0, messages: 0, maxTickMs: 0, physicsCpuMs: 0, physicsPeakRssBytes: 0, physicsPeakTrackedBytes: 0 };
  constructor(readonly code: string, readonly root: string, readonly levels: string[], readonly options: RoomOptions = defaults, readonly now = () => performance.now()) {}
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
      level: this.hole, remaining: Math.max(0, this.deadline - this.now()), worldTime: this.worldTime,
      players: [...this.members.values()].map(m => ({ id: m.id, nickname: m.nickname, color: m.color, avatar: m.avatar,
        connected: !!m.socket, ready: m.ready, scores: m.scores, dnf: m.dnf, total: m.scores.reduce((a,b) => a+b,0) })) };
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
    this.send(m,{ type:'welcome',id,token:m.token,code:this.code }); this.publish(); return m;
  }
  async reconnect(socket: WebSocket, token: unknown): Promise<Member> {
    const m=[...this.members.values()].find(m=> typeof token==='string' && m.token===token);
    if (!m || (m.disconnectedAt !== undefined && this.now()-m.disconnectedAt>this.options.reconnectTTL)) throw new Error('Reconexão expirada.');
    if (m.socket) throw new Error('Jogador já conectado.');
    m.socket=socket; m.disconnectedAt=undefined; m.ready=false;
    if (!this.host) this.host=m.id;
    if (this.physics) await this.physics.connected(m.slot,true);
    this.send(m,{type:'welcome',id:m.id,token:m.token,code:this.code,sequence:m.lastSequence});
    this.send(m,this.state());
    if (this.phase!=='lobby') this.send(m,{type:'load',level:Math.min(this.hole,this.holes-1),hole:this.hole});
    this.publish(); return m;
  }
  disconnect(m: Member, socket: WebSocket) {
    if (m.socket!==socket) return;
    m.socket=undefined; m.ready=false; m.disconnectedAt=this.now();
    void this.physics?.connected(m.slot,false).catch(e=>this.fail(e));
    if (m.id===this.host) this.host=[...this.members.values()].find(p=>p.socket)?.id ?? 0;
    this.publish();
  }
  async start(m: Member, holes: unknown) {
    if (m.id!==this.host || this.phase!=='lobby') throw new Error('Somente o anfitrião pode iniciar no lobby.');
    if (![3,6,9,18].includes(holes as number)) throw new Error('Escolha 3, 6, 9 ou 18 mapas.');
    this.holes=holes as number; this.hole=0; await this.load();
  }
  private async load() {
    this.phase='loading'; this.loading=true; this.deadline=0; this.worldTime=0;this.lastPhysicsCpu=0;
    for (const m of this.members.values()) { m.ready=false; m.ball=undefined; }
    this.lastSent.clear(); this.physics?.close();
    this.publish(); this.broadcast({type:'load',level:this.hole,hole:this.hole});
    try {
      this.physics=new Physics(this.root,this.levels[this.hole]!);
      await this.physics.ready;
      for (const m of this.members.values()) { await this.physics.add(m.slot,m.id); if (!m.socket) await this.physics.connected(m.slot,false); }
      this.loading=false; this.deadline=this.now()+this.options.loadingTimeout; this.lastStep=this.now(); this.accumulated=0;
      const frame=await this.physics.step(0); for (const b of frame.players) this.members.get(b.id)!.ball=b;
      this.snapshot(true); this.publish(); this.maybeBegin();
    } catch(e) { this.fail(e); }
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
    if (this.phase!=='playing' || this.now()>=this.deadline || !m.socket || !m.ready || m.ball?.moving || m.ball?.hole) throw new Error('Tacada indisponível.');
    const d=message.direction, power=message.power;
    if (!Array.isArray(d) || d.length!==3 || d.some(v=>typeof v!=='number' || !Number.isFinite(v) || Math.abs(v)>1) || Math.abs(d[1])>.001 || Math.hypot(d[0],d[2])<.001 || typeof power!=='number' || !Number.isFinite(power) || power<0 || power>1) throw new Error('Direção ou potência inválida.');
    if (!this.physics || !await this.physics.shot(m.slot,d,power)) throw new Error('Bola ainda em movimento.');
    if (m.ball) { m.ball.moving=true; m.ball.strokes++; }
    this.send(m,{type:'shot',sequence:seq,accepted:true});
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
    if (this.phase==='playing' && now>=this.deadline) { this.phase='settling'; this.deadline+=this.options.grace; this.publish(); }
    this.busy=true;
    try {
      this.accumulated+=(now-this.lastStep)*.12; this.lastStep=now;
      const ticks=Math.min(120,Math.floor(this.accumulated)); this.accumulated-=ticks;
      const started=performance.now(), frame=await this.physics.step(ticks);
      this.worldTime=frame.time; this.metrics.physicsTicks+=ticks; this.metrics.maxTickMs=Math.max(this.metrics.maxTickMs,performance.now()-started);
      this.metrics.physicsCpuMs+=Math.max(0,frame.cpuMs-this.lastPhysicsCpu);this.lastPhysicsCpu=frame.cpuMs;
      this.metrics.physicsPeakRssBytes=Math.max(this.metrics.physicsPeakRssBytes,frame.rssBytes);this.metrics.physicsPeakTrackedBytes=Math.max(this.metrics.physicsPeakTrackedBytes,frame.memoryBytes);
      for (const b of frame.players) this.members.get(b.id)!.ball=b;
      this.snapshot(++this.frameNumber % (this.options.snapshotHz*2) === 0);
      const active=[...this.members.values()].filter(m=>m.socket);
      if (active.length && active.every(m=>m.ball?.hole) || this.phase==='settling' && now>=this.deadline) this.finishHole();
    } catch(e) { this.fail(e); }
    finally { this.busy=false; }
  }
  private finishHole() {
    for (const m of this.members.values()) {
      const finished=!!m.ball?.hole;
      m.scores[this.hole]=finished ? m.ball!.strokes : this.options.penalty;
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
    const snapshot={type:'snapshot',full,hole:this.hole,time:this.worldTime,remaining:Math.max(0,this.deadline-this.now()),players};
    if (target) this.send(target,snapshot); else this.broadcast(snapshot);
    this.metrics.snapshots++;
  }
  fail(error: unknown) { if(this.closed)return;console.error(`[${this.code}]`,error); this.broadcast({type:'error',message:'Falha na física. Crie uma nova sala.'}); this.phase='finished'; this.physics?.close(); this.physics=undefined; this.publish(); }
  close() { this.closed=true;this.physics?.close(); for (const m of this.members.values()) m.socket?.close(1001,'Servidor encerrado'); }
}
