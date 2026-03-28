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
  getScheduleRules,
  addScheduleRule,
  editScheduleRule,
  toggleAllSchedules,
  removeScheduleRule,
  getCountdownRules,
  addCountdownRule,
  deleteCountdownRules,
  getAwayModeRules,
  addAwayModeRule,
  deleteAwayModeRules,
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

// Schedule Rules (Tapo)
router.get('/devices/:id/schedules', async (req, res) => {
  try {
    const rules = await getScheduleRules(req.params.id);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get schedules' });
  }
});

router.post('/devices/:id/schedules', async (req, res) => {
  try {
    const { smin, sact, eact, emin, repeat } = req.body;
    if (typeof smin !== 'number' || typeof sact !== 'string' || !Array.isArray(repeat)) {
      res.status(400).json({ error: 'smin, sact, and repeat are required' });
      return;
    }
    await addScheduleRule(req.params.id, { smin, sact, eact, emin, repeat });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add schedule' });
  }
});

router.put('/devices/:id/schedules/:ruleId', async (req, res) => {
  try {
    const { smin, sact, eact, emin, repeat, enable } = req.body;
    if (typeof smin !== 'number' || typeof sact !== 'string' || !Array.isArray(repeat) || typeof enable !== 'boolean') {
      res.status(400).json({ error: 'smin, sact, repeat, and enable are required' });
      return;
    }
    await editScheduleRule(req.params.id, req.params.ruleId, { smin, sact, eact, emin, repeat, enable });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to edit schedule' });
  }
});

router.delete('/devices/:id/schedules/:ruleId', async (req, res) => {
  try {
    await removeScheduleRule(req.params.id, req.params.ruleId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete schedule' });
  }
});

router.put('/devices/:id/schedules-enabled', async (req, res) => {
  try {
    const { enable } = req.body;
    if (typeof enable !== 'boolean') {
      res.status(400).json({ error: 'enable must be a boolean' });
      return;
    }
    await toggleAllSchedules(req.params.id, enable);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to toggle schedules' });
  }
});

// Countdown Timer
router.get('/devices/:id/countdown', async (req, res) => {
  try {
    const rules = await getCountdownRules(req.params.id);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get countdown rules' });
  }
});

router.post('/devices/:id/countdown', async (req, res) => {
  try {
    const { delay, desired_state } = req.body;
    if (typeof delay !== 'number' || delay < 1) {
      res.status(400).json({ error: 'delay must be a positive number (seconds)' });
      return;
    }
    const turnOn = desired_state === 'on';
    await addCountdownRule(req.params.id, delay, turnOn);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add countdown' });
  }
});

router.delete('/devices/:id/countdown/:ruleId', async (req, res) => {
  try {
    await deleteCountdownRules(req.params.id, [req.params.ruleId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete countdown' });
  }
});

// Away Mode (Anti-theft)
router.get('/devices/:id/away-mode', async (req, res) => {
  try {
    const rules = await getAwayModeRules(req.params.id);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get away mode rules' });
  }
});

router.post('/devices/:id/away-mode', async (req, res) => {
  try {
    const { frequency, start_time, end_time, duration } = req.body;
    if (typeof frequency !== 'number' || typeof start_time !== 'number' || typeof end_time !== 'number' || typeof duration !== 'number') {
      res.status(400).json({ error: 'frequency, start_time, end_time, and duration are required' });
      return;
    }
    await addAwayModeRule(req.params.id, { frequency, start_time, end_time, duration });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add away mode rule' });
  }
});

router.delete('/devices/:id/away-mode/:ruleId', async (req, res) => {
  try {
    await deleteAwayModeRules(req.params.id, [req.params.ruleId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete away mode rule' });
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
