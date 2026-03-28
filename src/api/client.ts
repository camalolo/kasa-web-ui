// src/api/client.ts
import type { Device, EmeterData, ScheduleRulesResponse, CountdownRulesResponse, AwayModeRulesResponse } from '../types/device';

const API_BASE = '/plugs/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Auth
export async function getAuthStatus(): Promise<{ loggedIn: boolean }> {
  return request<{ loggedIn: boolean }>('/auth/status');
}

export async function login(email: string, password: string): Promise<{ ok: boolean; devices: Device[] }> {
  return request<{ ok: boolean; devices: Device[] }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

// Discovery (refresh from cloud)
export async function refreshDevices(): Promise<Device[]> {
  return request<Device[]>('/discovery/start', { method: 'POST' });
}

// Device list
export async function getDevices(): Promise<Device[]> {
  return request<Device[]>('/devices');
}

// Single device
export async function getDevice(id: string): Promise<Device> {
  return request<Device>(`/devices/${encodeURIComponent(id)}`);
}

export async function getDeviceInfo(id: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/devices/${encodeURIComponent(id)}/info`);
}

// Power control
export async function setPowerState(id: string, value: boolean): Promise<{ ok: boolean; powerState: boolean }> {
  return request<{ ok: boolean; powerState: boolean }>(`/devices/${encodeURIComponent(id)}/power`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function togglePower(id: string): Promise<{ ok: boolean; powerState: boolean }> {
  return request<{ ok: boolean; powerState: boolean }>(`/devices/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
  });
}

// Rename
export async function setAlias(id: string, alias: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/alias`, {
    method: 'PUT',
    body: JSON.stringify({ alias }),
  });
}

// Energy monitoring
export async function getEmeter(id: string): Promise<{ supported: boolean; data: EmeterData | null }> {
  return request<{ supported: boolean; data: EmeterData | null }>(`/devices/${encodeURIComponent(id)}/emeter`);
}

// Sysinfo
export async function getSysInfo(id: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/devices/${encodeURIComponent(id)}/sysinfo`);
}

// --- Schedules ---
export async function getScheduleRules(id: string): Promise<ScheduleRulesResponse> {
  return request<ScheduleRulesResponse>(`/devices/${encodeURIComponent(id)}/schedules`);
}

export async function addSchedule(id: string, rule: { name: string; smin: number; sact: string; eact?: string; emin?: number; repeat: number[] }): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/schedules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function editSchedule(id: string, ruleId: string, rule: { name?: string; smin?: number; sact?: string; eact?: string; emin?: number; repeat?: number[]; enable?: boolean }): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/schedules/${encodeURIComponent(ruleId)}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
  });
}

export async function deleteSchedule(id: string, ruleId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/schedules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
}

export async function toggleAllSchedules(id: string, enable: boolean): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/schedules-enabled`, {
    method: 'PUT',
    body: JSON.stringify({ enable }),
  });
}

// --- Countdown Timer ---
export async function getCountdownRules(id: string): Promise<CountdownRulesResponse> {
  return request<CountdownRulesResponse>(`/devices/${encodeURIComponent(id)}/countdown`);
}

export async function addCountdown(id: string, delaySeconds: number, turnOn: boolean): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/countdown`, {
    method: 'POST',
    body: JSON.stringify({ delay: delaySeconds, desired_state: turnOn ? 'on' : 'off' }),
  });
}

export async function deleteCountdown(id: string, ruleId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/countdown/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
}

// --- Away Mode ---
export async function getAwayModeRules(id: string): Promise<AwayModeRulesResponse> {
  return request<AwayModeRulesResponse>(`/devices/${encodeURIComponent(id)}/away-mode`);
}

export async function addAwayMode(id: string, rule: { frequency: number; start_time: number; end_time: number; duration: number }): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/away-mode`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function deleteAwayMode(id: string, ruleId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/devices/${encodeURIComponent(id)}/away-mode/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
}
