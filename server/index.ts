// server/index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import deviceRoutes from './routes/devices.js';
import { initializeWebSocket } from './ws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// In production, serve the React build
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.resolve(__dirname, '../client');
  app.use(express.static(clientPath));
  // SPA fallback - serve index.html for non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`[Server] Kasa Web UI API running on http://localhost:${PORT}`);
});

// Initialize WebSocket
initializeWebSocket(server);
console.log(`[Server] WebSocket initialized on ws://localhost:${PORT}/ws`);
