import { useState, useEffect } from 'react';
import type { Device, ScheduleRulesResponse, CountdownRulesResponse, AwayModeRulesResponse, EmeterData } from '../types/device';
import ScheduleList from './ScheduleList';
import CountdownTimer from './CountdownTimer';
import AwayMode from './AwayMode';
import EnergyMonitor from './EnergyMonitor';

interface DeviceDetailsProps {
  device: Device;
  onClose: () => void;
  onRename: (id: string, alias: string) => Promise<void>;
  emeterData: EmeterData | null;
  fetchScheduleRules: (id: string) => Promise<ScheduleRulesResponse>;
  addSchedule: (id: string, rule: { name: string; smin: number; sact: string; eact?: string; emin?: number; repeat: number[] }) => Promise<void>;
  editSchedule: (id: string, ruleId: string, updates: Record<string, unknown>) => Promise<void>;
  deleteSchedule: (id: string, ruleId: string) => Promise<void>;
  toggleAllSchedules: (id: string, enable: boolean) => Promise<void>;
  fetchCountdownRules: (id: string) => Promise<CountdownRulesResponse>;
  addCountdown: (id: string, delaySeconds: number, turnOn: boolean) => Promise<void>;
  deleteCountdown: (id: string, ruleId: string) => Promise<void>;
  fetchAwayModeRules: (id: string) => Promise<AwayModeRulesResponse>;
  addAwayMode: (id: string, rule: { frequency: number; start_time: number; end_time: number; duration: number }) => Promise<void>;
  deleteAwayMode: (id: string, ruleId: string) => Promise<void>;
}

type TabId = 'info' | 'energy' | 'schedules' | 'timer' | 'away';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'info', label: 'Info', icon: '\u2139\uFE0F' },
  { id: 'energy', label: 'Energy', icon: '\u26A1' },
  { id: 'schedules', label: 'Schedules', icon: '\uD83D\uDCC5' },
  { id: 'timer', label: 'Timer', icon: '\u23F1\uFE0F' },
  { id: 'away', label: 'Away', icon: '\uD83C\uDFE0' },
];

export default function DeviceDetails({
  device,
  onClose,
  onRename,
  emeterData,
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
}: DeviceDetailsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [editName, setEditName] = useState(device.name);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [sysInfo, setSysInfo] = useState<Record<string, unknown> | null>(null);
  const [loadingSysInfo, setLoadingSysInfo] = useState(false);
  const [timeUsage, setTimeUsage] = useState<{ today: string; past7: string; past30: string } | null>(null);

  useEffect(() => {
    setEditName(device.name);
    setIsEditing(false);
    setSysInfo(null);
    setActiveTab('info');
    loadSysInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id]);

  async function loadSysInfo() {
    setLoadingSysInfo(true);
    try {
      const res = await fetch(`/plugs/api/devices/${encodeURIComponent(device.id)}/sysinfo`);
      const data = await res.json();
      setSysInfo(data);
      const today = data['time_usage_today'];
      const past7 = data['time_usage_past7'];
      const past30 = data['time_usage_past30'];
      if (today || past7 || past30) {
        setTimeUsage({
          today: typeof today === 'string' ? today : '0',
          past7: typeof past7 === 'string' ? past7 : '0',
          past30: typeof past30 === 'string' ? past30 : '0',
        });
      }
    } catch {
      // ignore
    }
    setLoadingSysInfo(false);
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

  function renderTabContent() {
    switch (activeTab) {
      case 'info':
        return renderInfoTab();
      case 'energy':
        return (
          <EnergyMonitor
            realtimeData={emeterData}
            timeUsage={timeUsage}
          />
        );
      case 'schedules':
        return (
          <ScheduleList
            deviceId={device.id}
            fetchScheduleRules={fetchScheduleRules}
            addSchedule={addSchedule}
            editSchedule={editSchedule}
            deleteSchedule={deleteSchedule}
            toggleAllSchedules={toggleAllSchedules}
          />
        );
      case 'timer':
        return (
          <CountdownTimer
            deviceId={device.id}
            fetchCountdownRules={fetchCountdownRules}
            addCountdown={addCountdown}
            deleteCountdown={deleteCountdown}
          />
        );
      case 'away':
        return (
          <AwayMode
            deviceId={device.id}
            fetchAwayModeRules={fetchAwayModeRules}
            addAwayMode={addAwayMode}
            deleteAwayMode={deleteAwayMode}
          />
        );
    }
  }

  function renderInfoTab() {
    return (
      <div className="space-y-6">
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
                {isRenaming ? '...' : '\u2713'}
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditName(device.name); }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
              >
                {'\u2715'}
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
                {'\u270F\uFE0F'}
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
            <span className="text-gray-600">{'\u2022'}</span>
            <span className="text-sm text-gray-400">
              {device.online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Time usage */}
        {timeUsage && (
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Runtime</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: 'Today', value: timeUsage.today, icon: '\u23F1\uFE0F' },
                { label: 'Past 7d', value: timeUsage.past7, icon: '\uD83D\uDCC5' },
                { label: 'Past 30d', value: timeUsage.past30, icon: '\uD83D\uDCCA' },
              ] as const).map(({ label, value, icon }) => (
                <div key={label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-sm mb-0.5">{icon}</div>
                  <div className="text-sm font-bold text-blue-400">{formatRuntime(value)}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device info grid */}
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Device Info</label>
          <div className="bg-gray-800/50 rounded-lg divide-y divide-gray-700">
            {([
              ['Model', device.model],
              ['IP Address', device.host],
              ['MAC Address', device.mac],
              ['Type', device.deviceType],
              ['Software', device.softwareVersion || '\u2014'],
              ['Hardware', device.hardwareVersion || '\u2014'],
            ] as const).map(([label, value]) => (
              <div key={String(label)} className="flex justify-between items-center px-4 py-2.5">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-sm font-mono">{value}</span>
              </div>
            ))}
          </div>
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
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-gray-900 border-l border-gray-800 slide-in-right flex flex-col">
        {/* Header */}
        <div className="shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{'\uD83D\uDD0C'}</span>
            <h2 className="text-lg font-semibold truncate">{device.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-gray-800 overflow-x-auto">
          <div className="flex px-4 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'}
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

function formatRuntime(minutesStr: string): string {
  const totalMin = parseInt(minutesStr, 10) || 0;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
