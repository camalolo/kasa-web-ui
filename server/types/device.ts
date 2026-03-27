// src/types/device.ts

/** Lightweight device info returned in list endpoints */
export interface Device {
  id: string;
  name: string;
  model: string;
  host: string;
  port: number;
  deviceType: 'plug' | 'bulb' | 'device';
  mac: string;
  relayState: boolean;
  ledState: boolean;
  online: boolean;
  supportsEmeter: boolean;
  softwareVersion: string;
  hardwareVersion: string;
  children?: DeviceChild[];
}

/** Child plug (for multi-outlet devices like HS300) */
export interface DeviceChild {
  id: string;
  name: string;
  state: boolean;
}

/** Full device info from getInfo() */
export interface DeviceInfo {
  sysInfo: Record<string, unknown>;
  emeter: EmeterRealtime | null;
  schedule: Record<string, unknown> | null;
  cloud: Record<string, unknown> | null;
}

/** Energy monitoring realtime data */
export interface EmeterData {
  voltage: number;       // V
  current: number;       // A
  power: number;         // W
  total: number;         // kWh
  powerFactor?: number;  // 0-1
}

/** Energy monitoring data from emeter.get_realtime (raw from device) */
export interface EmeterRealtime {
  voltage_mv: number;
  current_ma: number;
  power_mw: number;
  total_wh: number;
  err_code: number;
}

/** Energy monitoring monthly/daily stats */
export interface EmeterStats {
  day_list: EmeterStatEntry[];
  month_list: EmeterStatEntry[];
}

export interface EmeterStatEntry {
  time: string;    // YYYY-MM-DD or YYYY-MM
  value: number;   // Wh or kWh depending on context
}

/** Schedule rule from plug.schedule */
export interface ScheduleRule {
  id: string;
  name: string;
  enable: boolean;
  type: string;    // usually 'schedule'
  sact: string;    // action: 'on', 'off'
  smin: number;    // minutes from midnight
  eact?: string;
  emin?: number;
  repeat: number;  // bitmask for days of week
  // raw data for anything else
  [key: string]: unknown;
}

/** Discovery state */
export type DiscoveryStatus = 'idle' | 'discovering' | 'error';

/** WebSocket event types from server to client */
export type WsEventType =
  | 'device-new'
  | 'device-online'
  | 'device-offline'
  | 'power-update'
  | 'emeter-realtime-update'
  | 'in-use-update'
  | 'discovery-error';

export interface WsEvent {
  type: WsEventType;
  deviceId: string;
  payload: Record<string, unknown>;
}
