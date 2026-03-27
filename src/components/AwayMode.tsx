import { useState, useEffect, useCallback } from 'react';
import type { AwayModeRule, AwayModeRulesResponse } from '../types/device';

interface AwayModeProps {
  deviceId: string;
  fetchAwayModeRules: (id: string) => Promise<AwayModeRulesResponse>;
  addAwayMode: (id: string, rule: { frequency: number; start_time: number; end_time: number; duration: number }) => Promise<void>;
  deleteAwayMode: (id: string, ruleId: string) => Promise<void>;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function AwayMode({
  deviceId,
  fetchAwayModeRules,
  addAwayMode,
  deleteAwayMode,
}: AwayModeProps) {
  const [rules, setRules] = useState<AwayModeRule[]>([]);
  const [allEnabled, setAllEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [frequency, setFrequency] = useState(30);
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('07:00');
  const [duration, setDuration] = useState(10);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAwayModeRules(deviceId);
      setRules(data.rule_list ?? []);
      setAllEnabled(data.enable ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load away mode rules');
    }
    setLoading(false);
  }, [deviceId, fetchAwayModeRules]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function resetForm() {
    setFrequency(30);
    setStartTime('20:00');
    setEndTime('07:00');
    setDuration(10);
    setShowAddForm(false);
  }

  async function handleAdd() {
    setSubmitting(true);
    try {
      await addAwayMode(deviceId, {
        frequency,
        start_time: timeToMinutes(startTime),
        end_time: timeToMinutes(endTime),
        duration,
      });
      resetForm();
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add away mode rule');
    }
    setSubmitting(false);
  }

  async function handleDelete(ruleId: string) {
    if (!confirm('Delete this away mode rule? This cannot be undone.')) return;
    try {
      await deleteAwayMode(deviceId, ruleId);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete away mode rule');
    }
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <span>🏠</span> Away Mode
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Random on/off to simulate presence</p>
        </div>
        <div
          className={`toggle-switch ${allEnabled ? 'on' : 'off'}`}
          onClick={() => {
            setAllEnabled(!allEnabled);
          }}
          title={allEnabled ? 'Disable away mode' : 'Enable away mode'}
        >
          <div className="toggle-knob" />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/30 rounded-lg px-3 py-2 mb-3">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-700/50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-600 rounded w-24 mb-2" />
              <div className="h-3 bg-gray-600 rounded w-40" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 && !showAddForm ? (
        <div className="text-center py-6 text-gray-500">
          <span className="text-3xl block mb-2">🏠</span>
          <p className="text-sm mb-1">No away mode rules configured</p>
          <p className="text-xs text-gray-600 mb-3">
            Add a rule to randomly toggle this device on/off and simulate someone being home
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            + Add Rule
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-gray-900/50 rounded-lg px-4 py-3 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{rule.enable ? '🟢' : '⚫'}</span>
                  <span className="text-sm font-medium text-gray-300">
                    Every {rule.frequency}min, {minutesToTime(rule.start_time)}-{minutesToTime(rule.end_time)}
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
              <div className="flex items-center justify-between ml-6">
                <span className="text-xs text-gray-400">
                  Each toggle lasts {rule.duration}min
                </span>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors px-1"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full text-sm text-emerald-400 hover:text-emerald-300 hover:bg-gray-800/50 rounded-lg py-2 transition-colors"
            >
              + Add Rule
            </button>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="mt-3 bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
          <h4 className="text-sm font-semibold text-gray-300">Add Away Mode Rule</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Frequency</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={frequency}
                  onChange={(e) => setFrequency(Math.max(5, Math.min(120, parseInt(e.target.value, 10) || 5)))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">min</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">min</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Rule'}
            </button>
            <button
              onClick={resetForm}
              disabled={submitting}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
