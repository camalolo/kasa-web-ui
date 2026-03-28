import { useState, useEffect, useCallback, useRef } from 'react';
import type { CountdownRulesResponse } from '../types/device';

interface CountdownTimerProps {
  deviceId: string;
  fetchCountdownRules: (id: string) => Promise<CountdownRulesResponse>;
  addCountdown: (id: string, delaySeconds: number, turnOn: boolean) => Promise<void>;
  deleteCountdown: (id: string, ruleId: string) => Promise<void>;
}

function formatSeconds(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const PRESETS: { label: string; seconds: number }[] = [
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '2h', seconds: 7200 },
];

interface LiveRule {
  id: string;
  delay: number;
  fetchedRemain: number;
  fetchedAt: number;
  turnOn: boolean;
  enable: boolean;
  _delete: () => void;
}

function TimerDisplay({ rule }: { rule: LiveRule }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((now - rule.fetchedAt) / 1000);
  const remain = Math.max(rule.fetchedRemain - elapsed, 0);
  const progress = rule.delay > 0 ? ((rule.delay - remain) / rule.delay) * 100 : 0;

  return (
    <div className="bg-gray-900/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{rule.turnOn ? '🟢' : '🔴'}</span>
          <span className={`text-sm font-medium ${rule.turnOn ? 'text-emerald-400' : 'text-orange-400'}`}>
            Turn {rule.turnOn ? 'On' : 'Off'}
          </span>
          {rule.enable && (
            <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded">
              enabled
            </span>
          )}
        </div>
        <button
          onClick={() => rule._delete()}
          className="text-red-400 hover:text-red-300 text-xs transition-colors"
        >
          ✕ Cancel
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
        <span>Delay: {formatSeconds(rule.delay)}</span>
        {remain > 0 && (
          <span className="font-mono text-sm text-gray-200">
            {formatSeconds(remain)} remaining
          </span>
        )}
      </div>

      <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            rule.turnOn ? 'bg-emerald-500' : 'bg-orange-500'
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function CountdownTimer({
  deviceId,
  fetchCountdownRules,
  addCountdown,
  deleteCountdown,
}: CountdownTimerProps) {
  const [rules, setRules] = useState<LiveRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustom, setShowCustom] = useState<'on' | 'off' | null>(null);
  const deleteRef = useRef<(ruleId: string) => void>(() => {});

  const loadRules = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchCountdownRules(deviceId);
      const list = (res.rule_list ?? [])
        .filter((r) => r.remain > 0)
        .map((r): LiveRule => ({
          id: r.id,
          delay: r.delay,
          fetchedRemain: r.remain,
          fetchedAt: Date.now(),
          turnOn: r.desired_states?.on ?? true,
          enable: r.enable,
          _delete: () => {},
        }));
      setRules(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load countdown rules');
    } finally {
      setLoading(false);
    }
  }, [deviceId, fetchCountdownRules]);

  useEffect(() => {
    setLoading(true);
    loadRules();
  }, [loadRules]);

  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (syncRef.current) {
      clearInterval(syncRef.current);
      syncRef.current = null;
    }
    if (rules.length > 0) {
      syncRef.current = setInterval(loadRules, 30000);
    }
    return () => {
      if (syncRef.current) {
        clearInterval(syncRef.current);
        syncRef.current = null;
      }
    };
  }, [rules.length, loadRules]);

  deleteRef.current = async (ruleId: string) => {
    setError(null);
    try {
      await deleteCountdown(deviceId, ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete countdown');
    }
  };

  const handleAdd = async (delaySeconds: number, turnOn: boolean) => {
    setAdding(true);
    setError(null);
    try {
      await addCountdown(deviceId, delaySeconds, turnOn);
      setShowCustom(null);
      setCustomMinutes('');
      await loadRules();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add countdown';
      setError(msg.includes('-1802') ? 'Only one timer allowed at a time. Cancel the existing timer first.' : msg);
    } finally {
      setAdding(false);
    }
  };

  const handleCustomSubmit = (turnOn: boolean) => {
    const minutes = parseInt(customMinutes, 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) return;
    handleAdd(minutes * 60, turnOn);
  };

  const rulesWithDelete = rules.map((r) => ({ ...r, _delete: () => deleteRef.current(r.id) }));

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <span>⏱️</span> Countdown Timer
        </h3>
        <button
          onClick={loadRules}
          disabled={loading}
          className="text-gray-400 hover:text-gray-200 disabled:opacity-50 text-sm px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          ↻
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quick Timer</h4>

          {rules.length > 0 && (
            <div className="text-xs text-yellow-500/80">A timer is already active. Cancel it to set a new one.</div>
          )}

          <div>
            <span className="text-xs text-orange-400 mb-1.5 block font-medium">Turn Off after:</span>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESETS.map(({ label, seconds }) => (
                <button
                  key={`off-${label}`}
                  onClick={() => handleAdd(seconds, false)}
                  disabled={adding || rules.length > 0}
                  className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors border border-gray-700"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowCustom(showCustom === 'off' ? null : 'off');
                  setCustomMinutes('');
                }}
                disabled={adding || rules.length > 0}
                className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors border border-gray-700"
              >
                Custom
              </button>
            </div>
            {showCustom === 'off' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Min"
                  className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 w-24 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={() => handleCustomSubmit(false)}
                  disabled={adding || !customMinutes}
                  className="bg-orange-600 hover:bg-orange-500 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Set
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="text-xs text-emerald-400 mb-1.5 block font-medium">Turn On after:</span>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESETS.map(({ label, seconds }) => (
                <button
                  key={`on-${label}`}
                  onClick={() => handleAdd(seconds, true)}
                  disabled={adding || rules.length > 0}
                  className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors border border-gray-700"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowCustom(showCustom === 'on' ? null : 'on');
                  setCustomMinutes('');
                }}
                disabled={adding || rules.length > 0}
                className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors border border-gray-700"
              >
                Custom
              </button>
            </div>
            {showCustom === 'on' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Min"
                  className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 w-24 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleCustomSubmit(true)}
                  disabled={adding || !customMinutes}
                  className="bg-emerald-600 hover:bg-emerald-500 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Set
                </button>
              </div>
            )}
          </div>

          {adding && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full" />
              Adding timer...
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Active Timers</h4>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="h-4 bg-gray-600 rounded w-24 mb-2" />
                  <div className="h-2 bg-gray-600 rounded-full" />
                </div>
              ))}
            </div>
          ) : rulesWithDelete.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <span className="text-2xl block mb-2">⏱️</span>
              <p className="text-sm">No active timers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rulesWithDelete.map((rule) => (
                <TimerDisplay key={rule.id} rule={rule} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
