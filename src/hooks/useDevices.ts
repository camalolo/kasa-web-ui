// src/hooks/useDevices.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Device, EmeterData, EnergyData, ScheduleRulesResponse, CountdownRulesResponse, AwayModeRulesResponse } from '../types/device';
import * as api from '../api/client';
import { encrypt, decrypt } from '../utils/crypto';

const LS_AUTH_KEY = 'tapo-auth';
const SS_KEY_KEY = 'tapo-key';

export interface UseDevicesReturn {
  loggedIn: boolean;
  loginLoading: boolean;
  scanning: boolean;
  initializing: boolean;
  devices: Device[];
  selectedDeviceId: string | null;
  error: string | null;
  emeterData: Record<string, EmeterData>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  selectDevice: (id: string | null) => void;
  refreshDevices: () => Promise<void>;
  togglePower: (id: string) => Promise<void>;
  setPowerState: (id: string, value: boolean) => Promise<void>;
  renameDevice: (id: string, alias: string) => Promise<void>;
  refreshEmeter: (id: string) => Promise<EmeterData | null>;
  // Schedule CRUD
  fetchScheduleRules: (id: string) => Promise<ScheduleRulesResponse>;
  addSchedule: (id: string, rule: { name: string; smin: number; sact: string; eact?: string; emin?: number; repeat: number[] }) => Promise<void>;
  editSchedule: (id: string, ruleId: string, updates: { name?: string; smin?: number; sact?: string; eact?: string; emin?: number; repeat?: number[]; enable?: boolean }) => Promise<void>;
  deleteSchedule: (id: string, ruleId: string) => Promise<void>;
  toggleAllSchedules: (id: string, enable: boolean) => Promise<void>;
  // Countdown
  fetchCountdownRules: (id: string) => Promise<CountdownRulesResponse>;
  addCountdown: (id: string, delaySeconds: number, turnOn: boolean) => Promise<void>;
  deleteCountdown: (id: string, ruleId: string) => Promise<void>;
  // Away mode
  fetchAwayModeRules: (id: string) => Promise<AwayModeRulesResponse>;
  addAwayMode: (id: string, rule: { frequency: number; start_time: number; end_time: number; duration: number }) => Promise<void>;
  deleteAwayMode: (id: string, ruleId: string) => Promise<void>;
  // Energy history
  fetchEnergyData: (id: string, year: number, month: number) => Promise<EnergyData>;
}

export function useDevices(): UseDevicesReturn {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emeterData, setEmeterData] = useState<Record<string, EmeterData>>({});
  const emeterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoginLoading(true);
    setScanning(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      setDevices((prev) => {
        const merged = new Map<string, Device>();
        for (const d of prev) merged.set(d.id, d);
        for (const d of result.devices) merged.set(d.id, d);
        return Array.from(merged.values());
      });
      setLoggedIn(true);
      const persisted = await encrypt(email, password);
      localStorage.setItem(LS_AUTH_KEY, persisted.encrypted);
      sessionStorage.setItem(SS_KEY_KEY, persisted.key);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setScanning(false);
      setLoginLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(LS_AUTH_KEY);
    sessionStorage.removeItem(SS_KEY_KEY);
    await api.logout();
    setLoggedIn(false);
    setDevices([]);
    setSelectedDeviceId(null);
    setEmeterData({});
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const tryAutoLogin = async () => {
      try {
        const stored = localStorage.getItem(LS_AUTH_KEY);
        const storedKey = sessionStorage.getItem(SS_KEY_KEY);
        if (stored && storedKey) {
          try {
            const creds = await decrypt({ encrypted: stored, key: storedKey });
            if (creds) {
              const success = await login(creds.email, creds.password);
              if (success) return;
            }
          } catch {
            // Decryption failed — fall through
          }
        }
        const { loggedIn: backendLoggedIn } = await api.getAuthStatus();
        setLoggedIn(backendLoggedIn);
        if (backendLoggedIn) refreshDevices();
      } catch {
        // ignore
      } finally {
        setInitializing(false);
      }
    };
    tryAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      setScanning(true);
      const freshDevices = await api.refreshDevices();
      setDevices((prev) => {
        const merged = new Map<string, Device>();
        for (const d of prev) merged.set(d.id, d);
        for (const d of freshDevices) merged.set(d.id, d);
        return Array.from(merged.values());
      });
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  }, []);

  const togglePower = useCallback(async (id: string) => {
    try {
      const result = await api.togglePower(id);
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, relayState: result.powerState } : d)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle power');
      throw err;
    }
  }, []);

  const setPowerState = useCallback(async (id: string, value: boolean) => {
    try {
      await api.setPowerState(id, value);
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, relayState: value } : d)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set power state');
      throw err;
    }
  }, []);

  const renameDevice = useCallback(async (id: string, alias: string) => {
    try {
      await api.setAlias(id, alias);
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, name: alias } : d)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename device');
      throw err;
    }
  }, []);

  const refreshEmeter = useCallback(async (id: string): Promise<EmeterData | null> => {
    try {
      const result = await api.getEmeter(id);
      if (result.supported && result.data) {
        setEmeterData((prev) => ({ ...prev, [id]: result.data! }));
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchScheduleRules = useCallback(async (id: string): Promise<ScheduleRulesResponse> => {
    try {
      return await api.getScheduleRules(id);
    } catch {
      return { enable: true, rule_list: [] };
    }
  }, []);

  const addSchedule = useCallback(async (id: string, rule: { name: string; smin: number; sact: string; eact?: string; emin?: number; repeat: number[] }) => {
    await api.addSchedule(id, rule);
  }, []);

  const editSchedule = useCallback(async (id: string, ruleId: string, updates: { name?: string; smin?: number; sact?: string; eact?: string; emin?: number; repeat?: number[]; enable?: boolean }) => {
    await api.editSchedule(id, ruleId, updates);
  }, []);

  const deleteSchedule = useCallback(async (id: string, ruleId: string) => {
    await api.deleteSchedule(id, ruleId);
  }, []);

  const toggleAllSchedules = useCallback(async (id: string, enable: boolean) => {
    await api.toggleAllSchedules(id, enable);
  }, []);

  const fetchCountdownRules = useCallback(async (id: string): Promise<CountdownRulesResponse> => {
    try {
      return await api.getCountdownRules(id);
    } catch {
      return { enable: true, rule_list: [] };
    }
  }, []);

  const addCountdown = useCallback(async (id: string, delaySeconds: number, turnOn: boolean) => {
    await api.addCountdown(id, delaySeconds, turnOn);
  }, []);

  const deleteCountdown = useCallback(async (id: string, ruleId: string) => {
    await api.deleteCountdown(id, ruleId);
  }, []);

  const fetchAwayModeRules = useCallback(async (id: string): Promise<AwayModeRulesResponse> => {
    try {
      return await api.getAwayModeRules(id);
    } catch {
      return { enable: true, rule_list: [] };
    }
  }, []);

  const addAwayMode = useCallback(async (id: string, rule: { frequency: number; start_time: number; end_time: number; duration: number }) => {
    await api.addAwayMode(id, rule);
  }, []);

  const deleteAwayMode = useCallback(async (id: string, ruleId: string) => {
    await api.deleteAwayMode(id, ruleId);
  }, []);

  const fetchEnergyData = useCallback(async (id: string, year: number, month: number): Promise<EnergyData> => {
    try {
      return await api.getEnergyData(id, year, month);
    } catch {
      return { day_list: [], month_list: [] };
    }
  }, []);

  useEffect(() => {
    if (emeterIntervalRef.current) {
      clearInterval(emeterIntervalRef.current);
      emeterIntervalRef.current = null;
    }

    if (selectedDeviceId) {
      const device = devices.find((d) => d.id === selectedDeviceId);
      if (device?.supportsEmeter) {
        refreshEmeter(selectedDeviceId);
        emeterIntervalRef.current = setInterval(() => {
          refreshEmeter(selectedDeviceId);
        }, 5000);
      }
    }

    return () => {
      if (emeterIntervalRef.current) {
        clearInterval(emeterIntervalRef.current);
        emeterIntervalRef.current = null;
      }
    };
  }, [selectedDeviceId, devices, refreshEmeter]);

  const selectDevice = useCallback((id: string | null) => {
    setSelectedDeviceId(id);
    setEmeterData({});
  }, []);

  return {
    loggedIn,
    loginLoading,
    scanning,
    initializing,
    devices,
    selectedDeviceId,
    error,
    emeterData,
    login,
    logout,
    selectDevice,
    refreshDevices,
    togglePower,
    setPowerState,
    renameDevice,
    refreshEmeter,
    fetchScheduleRules,
    addSchedule,
    editSchedule,
    deleteSchedule,
    toggleAllSchedules,
    fetchCountdownRules,
    addCountdown,
    deleteCountdown,
    fetchAwayModeRules,
    addAwayMode,
    deleteAwayMode,
    fetchEnergyData,
  };
}
