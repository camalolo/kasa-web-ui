// server/kasa.ts
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import type { Device, EmeterData } from './types/device.js';
import { getOrCreateRawSession, clearAllRawSessions } from './tapo-protocol.js';

const require = createRequire(import.meta.url);
const { cloudLogin, loginDeviceByIp } = require('tp-link-tapo-connect');

function normalizeMac(mac: string): string {
  return mac.replace(/[:\-\.]/g, '').toUpperCase();
}

function getLanSubnets(): string[] {
  const subnets: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        const parts = net.address.split('.');
        subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }
  return subnets;
}

function parseArpTable(): Map<string, string> {
  const table = new Map<string, string>();
  if (!existsSync('/proc/net/arp')) return table;

  const content = readFileSync('/proc/net/arp', 'utf-8');
  for (const line of content.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4 && parts[3] !== '00:00:00:00:00:00') {
      const ip = parts[0];
      const mac = parts[3];
      if (ip && mac) {
        table.set(normalizeMac(mac), ip);
      }
    }
  }
  return table;
}

async function pingHost(ip: string): Promise<void> {
  try {
    execSync(`ping -c 1 -W 1 ${ip}`, { timeout: 2000, stdio: 'ignore' });
  } catch {
    // ignore - we just want to populate ARP
  }
}

export async function resolveMacToIp(mac: string): Promise<string | null> {
  const normalized = normalizeMac(mac);
  const table = parseArpTable();
  const cached = table.get(normalized);
  if (cached) return cached;

  // Try pinging the broadcast address to populate ARP table
  const subnets = getLanSubnets();
  const pingPromises = subnets.map(async (subnet) => {
    await pingHost(`${subnet}.255`);
  });
  await Promise.allSettled(pingPromises);

  const newTable = parseArpTable();
  return newTable.get(normalized) ?? null;
}

// In-memory session store
let sessionEmail: string | null = null;
let sessionPassword: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deviceControllers = new Map<string, Promise<any>>();
// Map: deviceId → cached TapoDevice from cloud
const cloudDevices = new Map<string, { deviceId: string; deviceName: string; deviceModel: string; deviceMac: string; fwVer: string; deviceHwVer: string; deviceType: string; status: number; ip?: string }>();
// Map: deviceId → locally-resolved info
const localDeviceInfo = new Map<string, { ip: string; deviceOn: boolean; nickname: string }>();

function getCredentials(): { email: string; password: string } {
  if (!sessionEmail || !sessionPassword) {
    throw new Error('Not logged in');
  }
  return { email: sessionEmail, password: sessionPassword };
}

export async function login(email: string, password: string): Promise<Device[]> {
  sessionEmail = email;
  sessionPassword = password;

  const cloud = await cloudLogin(email, password);
  const devices = await cloud.listDevices();

  deviceControllers.clear();
  cloudDevices.clear();
  localDeviceInfo.clear();

  for (const d of devices) {
    cloudDevices.set(d.deviceId, d);
  }

  return queryDevicesLocally();
}

export function isLoggedIn(): boolean {
  return sessionEmail !== null;
}

export async function discoverDevices(_timeoutMs = 10000): Promise<Device[]> {
  if (!sessionEmail || !sessionPassword) {
    throw new Error('Not logged in');
  }

  const cloud = await cloudLogin(sessionEmail, sessionPassword);
  const devices = await cloud.listDevices();

  deviceControllers.clear();
  cloudDevices.clear();
  localDeviceInfo.clear();

  for (const d of devices) {
    cloudDevices.set(d.deviceId, d);
  }

  return queryDevicesLocally();
}

function getOrCreateController(deviceId: string): Promise<any> {
  if (deviceControllers.has(deviceId)) {
    return deviceControllers.get(deviceId)!;
  }

  const cloudDev = cloudDevices.get(deviceId);
  if (!cloudDev) {
    throw new Error(`Device ${deviceId} not found`);
  }

  const { email, password } = getCredentials();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupController = async (): Promise<any> => {
    // First try cached IP from local info, then cloud IP, then ARP resolution
    const local = localDeviceInfo.get(deviceId);
    let ip = local?.ip ?? cloudDev.ip;

    if (!ip) {
      ip = await resolveMacToIp(cloudDev.deviceMac) ?? undefined;
    }

    if (!ip) {
      throw new Error(`Cannot resolve IP for device ${deviceId} (MAC: ${cloudDev.deviceMac})`);
    }

    const ctrl = await loginDeviceByIp(email, password, ip);
    return ctrl;
  };

  const controllerPromise = setupController();
  deviceControllers.set(deviceId, controllerPromise);
  return controllerPromise;
}

async function queryDevicesLocally(): Promise<Device[]> {
  const devices: Device[] = [];

  for (const [deviceId, cloudDev] of cloudDevices) {
    try {
      const ip = cloudDev.ip ?? (await resolveMacToIp(cloudDev.deviceMac));

      if (!ip) {
        devices.push({
          id: deviceId,
          name: cloudDev.deviceName || 'Unknown',
          model: cloudDev.deviceModel,
          host: 'unknown',
          port: 80,
          deviceType: 'plug' as const,
          mac: cloudDev.deviceMac,
          relayState: false,
          ledState: true,
          online: false,
          supportsEmeter: true,
          softwareVersion: cloudDev.fwVer,
          hardwareVersion: cloudDev.deviceHwVer,
        });
        continue;
      }

      const ctrl = await getOrCreateController(deviceId);
      const info = await ctrl.getDeviceInfo();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const infoAny = info as any;

      localDeviceInfo.set(deviceId, {
        ip: infoAny.ip ?? ip,
        deviceOn: !!infoAny.device_on,
        nickname: infoAny.nickname ?? cloudDev.deviceName,
      });

      devices.push({
        id: deviceId,
        name: (infoAny.nickname ?? cloudDev.deviceName) || 'Unknown',
        model: cloudDev.deviceModel,
        host: infoAny.ip ?? ip,
        port: 80,
        deviceType: 'plug' as const,
        mac: cloudDev.deviceMac,
        relayState: !!infoAny.device_on,
        ledState: true,
        online: true,
        supportsEmeter: true,
        softwareVersion: cloudDev.fwVer,
        hardwareVersion: cloudDev.deviceHwVer,
      });
    } catch (err) {
      console.error(`Failed to query device ${deviceId} locally:`, err);
      devices.push({
        id: deviceId,
        name: cloudDev.deviceName || 'Unknown',
        model: cloudDev.deviceModel,
        host: cloudDev.ip ?? 'unreachable',
        port: 80,
        deviceType: 'plug' as const,
        mac: cloudDev.deviceMac,
        relayState: false,
        ledState: true,
        online: false,
        supportsEmeter: true,
        softwareVersion: cloudDev.fwVer,
        hardwareVersion: cloudDev.deviceHwVer,
      });
    }
  }

  return devices;
}

export async function getDevices(): Promise<Device[]> {
  // If we have local info, return current state; otherwise query locally
  if (localDeviceInfo.size === 0 && cloudDevices.size > 0) {
    return queryDevicesLocally();
  }

  const devices: Device[] = [];
  for (const [deviceId, cloudDev] of cloudDevices) {
    const local = localDeviceInfo.get(deviceId);
    devices.push({
      id: deviceId,
      name: (local?.nickname ?? cloudDev.deviceName) || 'Unknown',
      model: cloudDev.deviceModel,
      host: local?.ip ?? cloudDev.ip ?? 'unknown',
      port: 80,
      deviceType: 'plug' as const,
      mac: cloudDev.deviceMac,
      relayState: local?.deviceOn ?? false,
      ledState: true,
      online: !!local,
      supportsEmeter: true,
      softwareVersion: cloudDev.fwVer,
      hardwareVersion: cloudDev.deviceHwVer,
    });
  }
  return devices;
}

export async function getDevice(deviceId: string): Promise<Device | undefined> {
  const d = cloudDevices.get(deviceId);
  if (!d) return undefined;
  const local = localDeviceInfo.get(deviceId);
  return {
    id: d.deviceId,
    name: (local?.nickname ?? d.deviceName) || 'Unknown',
    model: d.deviceModel,
    host: local?.ip ?? d.ip ?? 'unknown',
    port: 80,
    deviceType: 'plug' as const,
    mac: d.deviceMac,
    relayState: local?.deviceOn ?? false,
    ledState: true,
    online: !!local,
    supportsEmeter: true,
    softwareVersion: d.fwVer,
    hardwareVersion: d.deviceHwVer,
  };
}

export async function getDeviceInfo(deviceId: string): Promise<Record<string, unknown>> {
  const ctrl = await getOrCreateController(deviceId);
  const info = await ctrl.getDeviceInfo();
  return info as Record<string, unknown>;
}

export async function setPowerState(deviceId: string, value: boolean): Promise<boolean> {
  const ctrl = await getOrCreateController(deviceId);
  if (value) {
    await ctrl.turnOn();
  } else {
    await ctrl.turnOff();
  }

  // Update local device info cache
  const local = localDeviceInfo.get(deviceId);
  if (local) {
    local.deviceOn = value;
  }

  return value;
}

export async function togglePowerState(deviceId: string): Promise<boolean> {
  const local = localDeviceInfo.get(deviceId);
  if (!local) throw new Error(`Device ${deviceId} not found or not queried locally`);
  const newState = !local.deviceOn;
  return setPowerState(deviceId, newState);
}

export async function setAlias(deviceId: string, alias: string): Promise<boolean> {
  // Tapo doesn't easily support rename via local API
  // For now, just update the local cache
  const cloudDev = cloudDevices.get(deviceId);
  if (cloudDev) {
    cloudDev.deviceName = alias;
  }
  return true;
}

export async function setLedState(_deviceId: string, _value: boolean): Promise<boolean> {
  // Tapo plugs don't have a standard LED toggle via local API
  return true;
}

export async function getEmeter(deviceId: string): Promise<EmeterData | null> {
  try {
    const ctrl = await getOrCreateController(deviceId);
    const data = await ctrl.getEnergyUsage() as Record<string, unknown>;
    return {
      power: (data.current_power ?? 0) as number,
      todayEnergy: (data.today_energy ?? 0) as number,
      monthEnergy: (data.month_energy ?? 0) as number,
      todayRuntime: (data.today_runtime ?? 0) as number,
      monthRuntime: (data.month_runtime ?? 0) as number,
      localTime: typeof data.local_time === 'string' ? data.local_time : undefined,
    };
  } catch {
    return null;
  }
}

async function getDeviceIp(deviceId: string): Promise<string> {
  const local = localDeviceInfo.get(deviceId);
  if (local?.ip) return local.ip;
  const cloudDev = cloudDevices.get(deviceId);
  if (!cloudDev) throw new Error(`Device ${deviceId} not found`);
  const ip = cloudDev.ip ?? (await resolveMacToIp(cloudDev.deviceMac));
  if (!ip) throw new Error(`Cannot resolve IP for device ${deviceId}`);
  return ip;
}

async function getRawSession(deviceId: string) {
  const ip = await getDeviceIp(deviceId);
  const { email, password } = getCredentials();
  return getOrCreateRawSession(ip, email, password);
}

// --- Schedules ---

function mapTapoScheduleToUI(rule: Record<string, unknown>): Record<string, unknown> {
  const desired = rule['desired_states'] as Record<string, unknown> | undefined;
  const sact = desired?.['on'] === true ? 'on' : 'off';
  const eact = rule['e_action'] as string | undefined;
  const weekDay = rule['week_day'] as number | undefined;
  let repeat: number[];
  if (typeof weekDay === 'number' && weekDay > 0) {
    repeat = [];
    for (let i = 0; i < 7; i++) {
      if (weekDay & (1 << i)) repeat.push(i);
    }
  } else {
    repeat = [];
  }
  return {
    ...rule,
    smin: rule['s_min'] ?? rule['smin'],
    sact,
    eact: eact === 'none' ? undefined : eact,
    emin: rule['e_min'] ?? rule['emin'],
    repeat,
  };
}

export async function getScheduleRules(deviceId: string): Promise<Record<string, unknown>> {
  const session = await getRawSession(deviceId);
  const raw = await session.send({
    method: 'get_schedule_rules',
    params: { start_index: 0 },
  });
  let payload: Record<string, unknown> = raw;
  if (raw['result'] && typeof raw['result'] === 'object' && !Array.isArray(raw['result'])) {
    payload = raw['result'] as Record<string, unknown>;
  }
  const scheduleRule = payload['schedule_rule'];
  if (scheduleRule && typeof scheduleRule === 'object' && !Array.isArray(scheduleRule)) {
    payload = { ...payload, ...(scheduleRule as Record<string, unknown>) };
  }
  const ruleList = payload['rule_list'];
  if (Array.isArray(ruleList)) {
    payload = { ...payload, rule_list: ruleList.map((r: unknown) => mapTapoScheduleToUI(r as Record<string, unknown>)) };
  }
  return payload;
}

export async function addScheduleRule(
  deviceId: string,
  rule: { name: string; smin: number; sact: string; eact?: string; emin?: number; repeat: number[] },
): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'add_schedule_rule',
    params: {
      schedule_rule: {
        name: rule.name,
        smin: rule.smin,
        sact: rule.sact,
        eact: rule.eact,
        emin: rule.emin,
        repeat: rule.repeat,
        enable: true,
      },
    },
  });
}

export async function editScheduleRule(
  deviceId: string,
  ruleId: string,
  updates: { name?: string; smin?: number; sact?: string; eact?: string; emin?: number; repeat?: number[]; enable?: boolean },
): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'edit_schedule_rule',
    params: {
      schedule_rule: {
        id: ruleId,
        ...updates,
      },
    },
  });
}

export async function deleteScheduleRules(deviceId: string, ruleIds: string[]): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'delete_schedule_rules',
    params: { id_list: ruleIds },
  });
}

export async function toggleAllSchedules(deviceId: string, enable: boolean): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'edit_schedule_rule',
    params: {
      schedule_rule: {
        id: 'all',
        enable,
      },
    },
  });
}

// --- Countdown Timer ---

export async function getCountdownRules(deviceId: string): Promise<Record<string, unknown>> {
  const session = await getRawSession(deviceId);
  return session.send({
    method: 'get_countdown_rules',
    params: { start_index: 0 },
  });
}

export async function addCountdownRule(deviceId: string, delaySeconds: number, turnOn: boolean): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'add_countdown_rule',
    params: {
      delay: delaySeconds,
      desired_states: { on: turnOn },
      enable: true,
    },
  });
}

export async function deleteCountdownRules(deviceId: string, ruleIds: string[]): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'delete_countdown_rules',
    params: { id_list: ruleIds },
  });
}

// --- Away Mode (Anti-theft) ---

export async function getAwayModeRules(deviceId: string): Promise<Record<string, unknown>> {
  const session = await getRawSession(deviceId);
  return session.send({
    method: 'get_anti_theft_rules',
    params: { start_index: 0 },
  });
}

export async function addAwayModeRule(
  deviceId: string,
  rule: { frequency: number; start_time: number; end_time: number; duration: number },
): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'add_anti_theft_rule',
    params: {
      anti_theft_rule: {
        frequency: rule.frequency,
        start_time: rule.start_time,
        end_time: rule.end_time,
        duration: rule.duration,
        enable: true,
      },
    },
  });
}

export async function deleteAwayModeRules(deviceId: string, ruleIds: string[]): Promise<void> {
  const session = await getRawSession(deviceId);
  await session.send({
    method: 'delete_anti_theft_rules',
    params: { id_list: ruleIds },
  });
}

// --- Energy Data ---

export async function getSchedule(_deviceId: string): Promise<Record<string, unknown>[]> {
  // Tapo schedule API not available in tp-link-tapo-connect
  return [];
}

export async function getSysInfo(deviceId: string): Promise<Record<string, unknown>> {
  return getDeviceInfo(deviceId);
}

export async function getInfo(deviceId: string): Promise<Record<string, unknown>> {
  return getDeviceInfo(deviceId);
}

export async function rebootDevice(_deviceId: string, _delay = 1): Promise<void> {
  throw new Error('Reboot not supported for Tapo devices');
}

export async function logout(): Promise<void> {
  sessionEmail = null;
  sessionPassword = null;
  deviceControllers.clear();
  cloudDevices.clear();
  localDeviceInfo.clear();
  clearAllRawSessions();
}
