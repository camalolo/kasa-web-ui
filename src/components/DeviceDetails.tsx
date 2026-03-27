// src/components/DeviceDetails.tsx
import { useState, useEffect } from 'react';
import type { Device, ScheduleRule } from '../types/device';

interface DeviceDetailsProps {
  device: Device;
  onClose: () => void;
  onRename: (id: string, alias: string) => Promise<void>;
  onSetLedState: (id: string, value: boolean) => Promise<void>;
  onReboot: (id: string) => Promise<void>;
  fetchSchedule: (id: string) => Promise<ScheduleRule[]>;
  emeterData: { voltage: number; current: number; power: number; total: number; powerFactor?: number } | null;
}

export default function DeviceDetails({
  device,
  onClose,
  onRename,
  onSetLedState,
  onReboot,
  fetchSchedule,
  emeterData,
}: DeviceDetailsProps) {
  const [editName, setEditName] = useState(device.name);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootCountdown, setRebootCountdown] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [sysInfo, setSysInfo] = useState<Record<string, unknown> | null>(null);
  const [loadingSysInfo, setLoadingSysInfo] = useState(false);
  const [ledState, setLedState] = useState(device.ledState);

  // Load sysinfo and schedules on mount
  useEffect(() => {
    loadSysInfo();
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id]);

  async function loadSysInfo() {
    setLoadingSysInfo(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(device.id)}/sysinfo`);
      const data = await res.json();
      setSysInfo(data);
    } catch {
      // ignore
    }
    setLoadingSysInfo(false);
  }

  async function loadSchedules() {
    setLoadingSchedules(true);
    const rules = await fetchSchedule(device.id);
    setSchedules(rules);
    setLoadingSchedules(false);
  }

  async function handleRename() {
    if (!editName.trim()) return;
    setIsRenaming(true);
    try {
      await onRename(device.id, editName.trim());
      setIsEditing(false);
    } catch {
      setEditName(device.name);
    }
    setIsRenaming(false);
  }

  async function handleLedToggle(value: boolean) {
    try {
      await onSetLedState(device.id, value);
      setLedState(value);
    } catch {
      // revert
    }
  }

  async function handleReboot() {
    if (!confirm('Are you sure you want to reboot this device? It will be unavailable for ~10 seconds.')) return;
    setIsRebooting(true);
    try {
      await onReboot(device.id);
      setRebootCountdown(15);
    } catch {
      // ignore
    }
    setIsRebooting(false);
  }

  // Countdown for reboot
  useEffect(() => {
    if (rebootCountdown === null) return;
    if (rebootCountdown <= 0) {
      setRebootCountdown(null);
      loadSysInfo();
      return;
    }
    const timer = setTimeout(() => setRebootCountdown(rebootCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [rebootCountdown]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function formatRepeat(repeat: number): string {
    if (repeat === 0) return 'Once';
    if (repeat === 127) return 'Every day';
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      if (repeat & (1 << i)) days.push(dayNames[i]!);
    }
    return days.join(', ');
  }

  function formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-gray-900 border-l border-gray-800 slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔌</span>
            <h2 className="text-lg font-semibold">Device Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Device name */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Name</label>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                  maxLength={32}
                />
                <button
                  onClick={handleRename}
                  disabled={isRenaming}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg disabled:opacity-50"
                >
                  {isRenaming ? '...' : '✓'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditName(device.name); }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">{device.name}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                  title="Rename"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Status</label>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${device.online ? 'bg-emerald-400 pulse-green' : 'bg-gray-600'}`} />
              <span className="text-sm">
                {device.relayState ? (
                  <span className="text-emerald-400 font-medium">Power On</span>
                ) : (
                  <span className="text-gray-400">Power Off</span>
                )}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-sm text-gray-400">
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Device info grid */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Device Info</label>
            <div className="bg-gray-800/50 rounded-lg divide-y divide-gray-700">
              {[
                ['Model', device.model],
                ['IP Address', device.host],
                ['Port', String(device.port)],
                ['MAC Address', device.mac],
                ['Type', device.deviceType],
                ['Software', device.softwareVersion || '—'],
                ['Hardware', device.hardwareVersion || '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-sm font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Energy monitoring */}
          {device.supportsEmeter && emeterData && (
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">⚡ Energy Monitoring</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Power', value: `${emeterData.power.toFixed(1)} W`, color: 'text-yellow-400' },
                  { label: 'Voltage', value: `${emeterData.voltage.toFixed(1)} V`, color: 'text-blue-400' },
                  { label: 'Current', value: `${emeterData.current.toFixed(3)} A`, color: 'text-purple-400' },
                  { label: 'Total', value: `${emeterData.total.toFixed(3)} kWh`, color: 'text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className={`text-lg font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Children (multi-outlet) */}
          {device.children && device.children.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Outlets</label>
              <div className="space-y-2">
                {device.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm">{child.name}</span>
                    <span className={`text-xs font-medium ${child.state ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {child.state ? 'On' : 'Off'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Controls</label>
            <div className="space-y-3">
              {/* LED toggle */}
              <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-medium">LED Indicator</div>
                  <div className="text-xs text-gray-500">
                    {ledState ? 'LED on' : 'Night mode (LED off)'}
                  </div>
                </div>
                <div
                  className={`toggle-switch ${ledState ? 'on' : 'off'}`}
                  onClick={() => handleLedToggle(!ledState)}
                >
                  <div className="toggle-knob" />
                </div>
              </div>

              {/* Reboot button */}
              <button
                onClick={handleReboot}
                disabled={isRebooting || rebootCountdown !== null}
                className="w-full px-4 py-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rebootCountdown !== null
                  ? `Rebooting... ${rebootCountdown}s`
                  : isRebooting
                    ? 'Rebooting...'
                    : '🔄 Reboot Device'}
              </button>
            </div>
          </div>

          {/* Schedules */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
              Schedules
              {loadingSchedules && <span className="ml-2 text-gray-600">Loading...</span>}
            </label>
            {schedules.length === 0 && !loadingSchedules ? (
              <p className="text-sm text-gray-500 py-2">No schedules configured.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((rule, idx) => (
                  <div
                    key={rule.id ?? idx}
                    className="bg-gray-800/50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {rule.sact === 'on' ? '🟢 Turn On' : '🔴 Turn Off'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        rule.enable ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-700 text-gray-500'
                      }`}>
                        {rule.enable ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                      <div>⏰ {formatMinutes(rule.smin)}</div>
                      <div>📅 {formatRepeat(rule.repeat)}</div>
                      {rule.name && rule.name !== '' && <div>📝 {rule.name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw sysinfo (collapsible) */}
          <details className="group">
            <summary className="text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors">
              Raw System Info
            </summary>
            <div className="mt-2 bg-gray-800/50 rounded-lg p-3 overflow-x-auto">
              {loadingSysInfo ? (
                <p className="text-xs text-gray-500">Loading...</p>
              ) : sysInfo ? (
                <pre className="text-[11px] text-gray-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(sysInfo, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-gray-500">Unavailable</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
