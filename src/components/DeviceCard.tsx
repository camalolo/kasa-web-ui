// src/components/DeviceCard.tsx
import QuickTimer from './QuickTimer';
import type { Device, CountdownRulesResponse } from '../types/device';

interface DeviceCardProps {
  device: Device;
  isSelected: boolean;
  onSelect: () => void;
  onTogglePower: () => void;
  setPowerState: (id: string, value: boolean) => Promise<void>;
  addCountdown: (id: string, delaySeconds: number, turnOn: boolean) => Promise<void>;
  deleteCountdown: (id: string, ruleId: string) => Promise<void>;
  fetchCountdownRules: (id: string) => Promise<CountdownRulesResponse>;
}

function getDeviceIcon(deviceType: string): string {
  switch (deviceType) {
    case 'plug':
      return '🔌';
    case 'bulb':
      return '💡';
    default:
      return '📱';
  }
}

function getChildCountText(device: Device): string {
  if (device.children && device.children.length > 0) {
    const onCount = device.children.filter((c) => c.state).length;
    return `${onCount}/${device.children.length} on`;
  }
  return '';
}

export default function DeviceCard({ device, isSelected, onSelect, onTogglePower, setPowerState, addCountdown, deleteCountdown, fetchCountdownRules }: DeviceCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        relative rounded-xl border p-4 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-emerald-500 bg-gray-900 ring-1 ring-emerald-500/30'
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900'
        }
        ${!device.online ? 'opacity-60' : ''}
      `}
    >
      {/* Status indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {device.online ? (
          <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full pulse-green" title="Online" />
        ) : (
          <div className="w-2.5 h-2.5 bg-gray-600 rounded-full" title="Offline" />
        )}
      </div>

      {/* Header: Icon + Name */}
      <div className="flex items-start gap-3 mb-4">
        <div className="text-3xl mt-0.5">{getDeviceIcon(device.deviceType)}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base truncate pr-6" title={device.name}>
            {device.name}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{device.model}</p>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 text-xs text-gray-400 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">IP:</span>
          <span className="font-mono">{device.host}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">MAC:</span>
          <span className="font-mono text-[11px]">{device.mac}</span>
        </div>
        {device.children && device.children.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Outlets:</span>
            <span>{getChildCountText(device)}</span>
          </div>
        )}
        {device.supportsEmeter && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">⚡</span>
            <span>Energy monitoring</span>
          </div>
        )}
      </div>

      {/* Power toggle */}
      <div
        className="flex items-center justify-between"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePower();
        }}
      >
        <span className="text-sm font-medium">
          {device.relayState ? (
            <span className="text-emerald-400">On</span>
          ) : (
            <span className="text-gray-500">Off</span>
          )}
        </span>
        <div className={`toggle-switch ${device.relayState ? 'on' : 'off'}`}>
          <div className="toggle-knob" />
        </div>
      </div>

      <QuickTimer
        deviceId={device.id}
        isOn={!!device.relayState}
        setPowerState={setPowerState}
        addCountdown={addCountdown}
        deleteCountdown={deleteCountdown}
        fetchCountdownRules={fetchCountdownRules}
      />
    </div>
  );
}
