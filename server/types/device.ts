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

export interface EmeterData {
  power: number;
  todayEnergy: number;
  monthEnergy: number;
  todayRuntime: number;
  monthRuntime: number;
  localTime?: string;
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
