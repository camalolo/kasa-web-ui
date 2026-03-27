// server/index.ts
import express from 'express';
import cors from 'cors';
import deviceRoutes from './routes/devices.js';
import { initializeWebSocket } from './ws.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Mount device routes
app.use('/api', deviceRoutes);

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Server] Kasa Web UI API running on http://127.0.0.1:${PORT}`);
});

// Initialize WebSocket
initializeWebSocket(server);
console.log(`[Server] WebSocket initialized on ws://127.0.0.1:${PORT}/ws`);
