// server/ws.ts
import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export function initializeWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    ws.send(JSON.stringify({ type: 'connected', payload: { timestamp: Date.now() } }));

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} total)`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error:`, err.message);
      clients.delete(ws);
    });
  });

  return wss;
}
