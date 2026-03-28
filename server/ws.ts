import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from './logger.js';

const log = createLogger('WS');

const clients = new Set<WebSocket>();

export function initializeWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    log.info(`Client connected (${clients.size} total)`);

    ws.send(JSON.stringify({ type: 'connected', payload: { timestamp: Date.now() } }));

    ws.on('close', () => {
      clients.delete(ws);
      log.info(`Client disconnected (${clients.size} total)`);
    });

    ws.on('error', (err) => {
      log.error('Client error', err);
      clients.delete(ws);
    });
  });

  return wss;
}
