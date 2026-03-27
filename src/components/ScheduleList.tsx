// src/components/ScheduleList.tsx
import { useState, useEffect } from 'react';
import type { ScheduleRule } from '../types/device';
import * as api from '../api/client';

interface ScheduleListProps {
  deviceId: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatRepeat(repeat: number): string {
  if (repeat === 0) return 'Once';
  if (repeat === 127) return 'Every day';
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (repeat & (1 << i)) days.push(DAY_NAMES[i]!);
  }
  return days.join(', ');
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function ScheduleList({ deviceId }: ScheduleListProps) {
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  async function loadSchedules() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSchedule(deviceId);
      setRules(data as unknown as ScheduleRule[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    }
    setLoading(false);
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <span>📅</span> Schedules
          <span className="text-xs text-gray-500 font-normal">({rules.length})</span>
        </h3>
        <button
          onClick={loadSchedules}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/30 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-700/50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-600 rounded w-24 mb-2" />
              <div className="h-3 bg-gray-600 rounded w-32" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <span className="text-3xl block mb-2">📅</span>
          <p className="text-sm">No schedules configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div
              key={rule.id ?? idx}
              className="bg-gray-900/50 rounded-lg px-4 py-3 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {rule.sact === 'on' ? '🟢' : '🔴'}
                  </span>
                  <span className="text-sm font-medium">
                    {rule.sact === 'on' ? 'Turn On' : 'Turn Off'}
                  </span>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    rule.enable
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-gray-700 text-gray-500'
                  }`}
                >
                  {rule.enable ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="text-xs text-gray-400 space-y-0.5 ml-6">
                <div>⏰ {formatMinutes(rule.smin as number)}</div>
                <div>📅 {formatRepeat(rule.repeat as number)}</div>
                {rule.name && rule.name !== '' && (
                  <div>📝 {rule.name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
