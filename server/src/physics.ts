import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type Ball = { id: number; pos: number[]; vel: number[]; moving: boolean; hole: boolean; water: boolean; strokes: number };
export type Frame = { time: number; players: Ball[]; cpuMs: number; rssBytes: number; memoryBytes: number };
export class Physics {
  private child: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  readonly ready: Promise<void>;
  constructor(root: string, level: string) {
    const executable = process.env.GOLF_PHYSICS_WORKER ?? [
      path.join(root, 'out/server-native/golf_physics_worker' + (process.platform === 'win32' ? '.exe' : '')),
      path.join(root, 'out/server-native/Release/golf_physics_worker.exe'),
    ].find(existsSync);
    if (!executable) throw new Error('Compile a física primeiro: npm run build:native');
    this.child = spawn(executable, [level], { cwd: root, windowsHide: true, stdio: 'pipe' });
    let resolveReady!: () => void, rejectReady!: (e: Error) => void;
    this.ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const startup = setTimeout(() => { rejectReady(new Error('Physics loading timed out')); this.close(); }, 10000);
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
    await this.ready;
    if (this.child.killed || this.child.exitCode !== null) throw new Error('Physics unavailable');
    const request = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(request); reject(new Error('Physics request timed out')); this.close(); }, 5000);
      this.pending.set(request, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ ...message, request }) + '\n');
    });
  }
  add(slot: number, id: number) { return this.command({ cmd: 'add', slot, id }); }
  connected(slot: number, connected: boolean) { return this.command({ cmd: 'connected', slot, connected }); }
  async shot(slot: number, direction: number[], power: number): Promise<boolean> { return (await this.command({ cmd: 'shot', slot, direction, power })).ok; }
  async step(ticks: number): Promise<Frame> { return this.command({ cmd: 'step', ticks }); }
  close() { this.child.kill(); }
}
