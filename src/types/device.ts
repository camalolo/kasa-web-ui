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
  emeter: EmeterData | null;
  schedule: Record<string, unknown> | null;
  cloud: Record<string, unknown> | null;
}

/** Energy monitoring realtime data */
export interface EmeterData {
  power: number;
  todayEnergy: number;
  monthEnergy: number;
  todayRuntime: number;
  monthRuntime: number;
  localTime?: string;
}

/** Tapo schedule rule */
export interface TapoScheduleRule {
  id: string;
  name: string;
  enable: boolean;
  smin: number;
  sact: string;
  eact?: string;
  emin?: number;
  repeat: number[];
  /** Keep raw data for any extra fields */
  [key: string]: unknown;
}

/** Countdown timer rule */
export interface CountdownRule {
  id: string;
  enable: boolean;
  delay: number;
  remain: number;
  desired_states: { on: boolean };
  [key: string]: unknown;
}

/** Away mode (anti-theft) rule */
export interface AwayModeRule {
  id: string;
  enable: boolean;
  frequency: number;
  start_time: number;
  end_time: number;
  duration: number;
  [key: string]: unknown;
}

/** Device time usage info (from getDeviceInfo) */
export interface TimeUsage {
  today: string;
  past7: string;
  past30: string;
}

/** Schedule rules response */
export interface ScheduleRulesResponse {
  enable: boolean;
  rule_list: TapoScheduleRule[];
  [key: string]: unknown;
}

/** Countdown rules response */
export interface CountdownRulesResponse {
  enable: boolean;
  rule_list: CountdownRule[];
  [key: string]: unknown;
}

/** Away mode rules response */
export interface AwayModeRulesResponse {
  enable: boolean;
  rule_list: AwayModeRule[];
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
