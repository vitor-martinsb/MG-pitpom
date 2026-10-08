import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createServer } from '../src/index.js';

test('WebSocket rejects invalid origins, binary, oversized, malformed and excessive messages', async () => {
  const app = createServer();
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address() as { port: number };
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const sockets: WebSocket[] = [];
  async function connect(origin?: string) {
    const socket = new WebSocket(url, origin ? { origin } : undefined);
    socket.on('error', () => {});
    sockets.push(socket);
    const closed = once(socket, 'close');
    await once(socket, 'open');
    return { socket, closed };
  }
  try {
    const origin = await connect('https://untrusted.example');
    assert.equal((await origin.closed)[0], 1008);
    const binary = await connect();
    binary.socket.send(Buffer.from([1, 2, 3]));
    assert.equal((await binary.closed)[0], 1003);
    const oversized = await connect();
    oversized.socket.send('x'.repeat(2049));
    assert.equal((await oversized.closed)[0], 1009);
    const malformed = await connect();
    malformed.socket.send('{');
    assert.equal((await malformed.closed)[0], 1007);
    const flooded = await connect();
    for (let i = 0; i < 31; i++) flooded.socket.send(JSON.stringify({ type: 'ping', sent: i }));
    assert.equal((await flooded.closed)[0], 1008);
    assert.equal(app.rooms.size, 0);
  } finally {
    for (const socket of sockets) socket.terminate();
    app.close();
  }
});
