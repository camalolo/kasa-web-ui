// src/hooks/useDevices.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Device, EmeterData, ScheduleRule } from '../types/device';
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
  fetchSchedule: (id: string) => Promise<ScheduleRule[]>;
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

  const fetchSchedule = useCallback(async (id: string): Promise<ScheduleRule[]> => {
    try {
      return await api.getSchedule(id);
    } catch {
      return [];
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
    fetchSchedule,
  };
}
