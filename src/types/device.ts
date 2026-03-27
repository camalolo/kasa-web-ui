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

/** Energy daily data point */
export interface EnergyDayData {
  day: number;
  time: string;
  value: number;
}

/** Energy monthly data point */
export interface EnergyMonthData {
  month: number;
  year: number;
  time: string;
  value: number;
}

/** Energy history response */
export interface EnergyData {
  day_list: EnergyDayData[];
  month_list: EnergyMonthData[];
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
