// src/components/EnergyMonitor.tsx
import type { EmeterData } from '../types/device';

interface EnergyMonitorProps {
  data: EmeterData | null;
  loading?: boolean;
}

export default function EnergyMonitor({ data, loading = false }: EnergyMonitorProps) {
  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-32 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-700/50 rounded-lg p-3">
              <div className="h-6 bg-gray-600 rounded w-20 mx-auto mb-1" />
              <div className="h-3 bg-gray-600 rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-4 text-center text-gray-500">
        <span className="text-2xl">⚡</span>
        <p className="text-sm mt-2">No energy data available</p>
        <p className="text-xs mt-1">This device may not support energy monitoring</p>
      </div>
    );
  }

  const metrics: { label: string; value: string; unit: string; color: string; icon: string }[] = [
    {
      label: 'Power',
      value: data.power < 10 ? data.power.toFixed(2) : data.power.toFixed(1),
      unit: 'W',
      color: 'text-yellow-400',
      icon: '⚡',
    },
    {
      label: 'Voltage',
      value: data.voltage.toFixed(1),
      unit: 'V',
      color: 'text-blue-400',
      icon: '🔋',
    },
    {
      label: 'Current',
      value: data.current < 1 ? (data.current * 1000).toFixed(0) : data.current.toFixed(3),
      unit: data.current < 1 ? 'mA' : 'A',
      color: 'text-purple-400',
      icon: '〰️',
    },
    {
      label: 'Total',
      value: data.total.toFixed(3),
      unit: 'kWh',
      color: 'text-emerald-400',
      icon: '📊',
    },
  ];

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <span>⚡</span> Energy Monitor
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, unit, color, icon }) => (
          <div key={label} className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="text-lg mb-0.5">{icon}</div>
            <div className={`text-lg font-bold ${color}`}>
              {value}
              <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {data.powerFactor !== undefined && (
        <div className="mt-3 text-center text-xs text-gray-500">
          Power Factor: {data.powerFactor.toFixed(2)}
        </div>
      )}
    </div>
  );
}
