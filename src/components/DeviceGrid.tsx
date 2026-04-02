// src/components/DeviceGrid.tsx
import type { Device, CountdownRulesResponse } from '../types/device';
import DeviceCard from './DeviceCard';

interface DeviceGridProps {
  devices: Device[];
  selectedDeviceId: string | null;
  scanning: boolean;
  onSelectDevice: (id: string) => void;
  onTogglePower: (id: string) => void;
  setPowerState: (id: string, value: boolean) => Promise<void>;
  addCountdown: (id: string, delaySeconds: number, turnOn: boolean) => Promise<void>;
  deleteCountdown: (id: string, ruleId: string) => Promise<void>;
  fetchCountdownRules: (id: string) => Promise<CountdownRulesResponse>;
}

export default function DeviceGrid({
  devices,
  selectedDeviceId,
  scanning,
  onSelectDevice,
  onTogglePower,
  setPowerState,
  addCountdown,
  deleteCountdown,
  fetchCountdownRules,
}: DeviceGridProps) {
  if (devices.length === 0) {
    if (scanning) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="relative mb-6">
            <span className="text-6xl animate-pulse">📡</span>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-gray-200">Scanning network…</h2>
          <p className="text-sm">Discovering TP-Link smart plugs on your local network. This may take a moment.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <span className="text-6xl mb-4">📡</span>
        <h2 className="text-xl font-semibold mb-2">No devices found</h2>
        <p className="text-sm">Click "Scan Network" to discover TP-Link smart plugs on your local network.</p>
      </div>
    );
  }

  return (
    <>
      {scanning && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-4 py-2">
          <span className="animate-spin inline-block">🔄</span>
          <span>Refreshing device information…</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          isSelected={device.id === selectedDeviceId}
          onSelect={() => onSelectDevice(device.id)}
          onTogglePower={() => onTogglePower(device.id)}
          setPowerState={setPowerState}
          addCountdown={addCountdown}
          deleteCountdown={deleteCountdown}
          fetchCountdownRules={fetchCountdownRules}
        />
      ))}
    </div>
    </>
  );
}
