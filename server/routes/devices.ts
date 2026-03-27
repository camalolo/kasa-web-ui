// server/routes/devices.ts
import { Router } from 'express';
import {
  login,
  logout,
  isLoggedIn,
  discoverDevices,
  getDevices,
  getDevice,
  getDeviceInfo,
  setPowerState,
  togglePowerState,
  setAlias,
  getEmeter,
  getSchedule,
  getSysInfo,
} from '../kasa.js';

const router = Router();

// Auth
router.get('/auth/status', (_req, res) => {
  res.json({ loggedIn: isLoggedIn() });
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'email and password required' });
      return;
    }
    const devices = await login(email, password);
    res.json({ ok: true, devices });
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed' });
  }
});

router.post('/auth/logout', async (_req, res) => {
  await logout();
  res.json({ ok: true });
});

// Discovery (refresh from cloud)
router.post('/discovery/start', async (_req, res) => {
  try {
    const devices = await discoverDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Discovery failed' });
  }
});

// Device list
router.get('/devices', async (_req, res) => {
  try {
    const devices = await getDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Single device
router.get('/devices/:id', async (req, res) => {
  try {
    const device = await getDevice(req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Full device info
router.get('/devices/:id/info', async (req, res) => {
  try {
    const info = await getDeviceInfo(req.params.id);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Power control
router.put('/devices/:id/power', async (req, res) => {
  try {
    const { value } = req.body;
    if (typeof value !== 'boolean') {
      res.status(400).json({ error: 'value must be a boolean' });
      return;
    }
    const result = await setPowerState(req.params.id, value);
    res.json({ ok: true, powerState: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/devices/:id/toggle', async (req, res) => {
  try {
    const powerState = await togglePowerState(req.params.id);
    res.json({ ok: true, powerState });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Rename
router.put('/devices/:id/alias', async (req, res) => {
  try {
    const { alias } = req.body;
    if (typeof alias !== 'string' || alias.length === 0) {
      res.status(400).json({ error: 'alias must be a non-empty string' });
      return;
    }
    await setAlias(req.params.id, alias);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Energy monitoring
router.get('/devices/:id/emeter', async (req, res) => {
  try {
    const data = await getEmeter(req.params.id);
    if (data === null) {
      res.json({ supported: false, data: null });
      return;
    }
    res.json({ supported: true, data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Schedules
router.get('/devices/:id/schedule', async (req, res) => {
  try {
    const rules = await getSchedule(req.params.id);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Sysinfo
router.get('/devices/:id/sysinfo', async (req, res) => {
  try {
    const info = await getSysInfo(req.params.id);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
