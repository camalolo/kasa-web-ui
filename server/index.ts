import express from 'express';
import cors from 'cors';
import deviceRoutes from './routes/devices.js';
import { initializeWebSocket } from './ws.js';
import { createLogger } from './logger.js';
import { requestLogger } from './request-logger.js';

const log = createLogger('Server');
const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api', deviceRoutes);

const server = app.listen(PORT, '127.0.0.1', () => {
  log.info(`Kasa Web UI API running on http://127.0.0.1:${PORT}`);
});

initializeWebSocket(server);
log.info(`WebSocket initialized on ws://127.0.0.1:${PORT}/ws`);
