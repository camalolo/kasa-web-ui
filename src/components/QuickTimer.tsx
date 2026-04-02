import { useState, useEffect, useCallback } from 'react';
import type { CountdownRulesResponse } from '../types/device';

interface QuickTimerProps {
  deviceId: string;
  isOn: boolean;
  setPowerState: (id: string, value: boolean) => Promise<void>;
  addCountdown: (id: string, delaySeconds: number, turnOn: boolean) => Promise<void>;
  deleteCountdown: (id: string, ruleId: string) => Promise<void>;
  fetchCountdownRules: (id: string) => Promise<CountdownRulesResponse>;
}

interface ActiveRule {
  id: string;
  delay: number;
  remain: number;
  fetchedAt: number;
}

const PRESETS = [
  { label: '1m', minutes: 1 },
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '60m', minutes: 60 },
];

function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export default function QuickTimer({
  deviceId,
  isOn,
  setPowerState,
  addCountdown,
  deleteCountdown,
  fetchCountdownRules,
}: QuickTimerProps) {
  const [activeRule, setActiveRule] = useState<ActiveRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadActiveRule = useCallback(async () => {
    try {
      const res = await fetchCountdownRules(deviceId);
      const rule = (res.rule_list ?? [])
        .filter((r) => r.remain > 0 && r.desired_states.on === false)[0];
      if (rule) {
        setActiveRule({
          id: rule.id,
          delay: rule.delay,
          remain: rule.remain,
          fetchedAt: Date.now(),
        });
      } else {
        setActiveRule(null);
      }
    } catch {
      // Silently ignore fetch errors for inline widget
    }
  }, [deviceId, fetchCountdownRules]);

  // Fetch rules when isOn changes
  useEffect(() => {
    if (isOn) {
      loadActiveRule();
    } else {
      setActiveRule(null);
    }
  }, [isOn, deviceId, loadActiveRule]);

  // 5s display tick — always running
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Derived remain from tick
  const elapsed = activeRule
    ? Math.max(0, Math.floor((now - activeRule.fetchedAt) / 1000))
    : 0;
  const remain = activeRule
    ? Math.min(activeRule.delay, activeRule.remain - elapsed)
    : 0;

  // When remain reaches 0, clear activeRule
  useEffect(() => {
    if (activeRule !== null && remain === 0) {
      setActiveRule(null);
    }
  }, [activeRule, remain]);

  // 30s device re-sync when activeRule exists
  useEffect(() => {
    if (activeRule === null) return;
    const id = setInterval(loadActiveRule, 30000);
    return () => clearInterval(id);
  }, [activeRule, loadActiveRule]);

  const handlePreset = async (minutes: number) => {
    setBusy(true);
    try {
      await setPowerState(deviceId, true);
      await addCountdown(deviceId, minutes * 60, false);
      await loadActiveRule();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('-1802')) {
        await loadActiveRule();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRule) return;
    setBusy(true);
    try {
      await deleteCountdown(deviceId, activeRule.id);
      setActiveRule(null);
    } catch {
      // Silently ignore — re-sync will correct state
    } finally {
      setBusy(false);
    }
  };

  // Loading/busy state
  if (busy) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full" />
        </div>
      </div>
    );
  }

  // Active countdown display
  if (activeRule !== null) {
    const progress = activeRule.delay > 0 ? ((activeRule.delay - remain) / activeRule.delay) * 100 : 0;
    return (
      <div onClick={(e) => e.stopPropagation()} className="mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-orange-400">⏱</span>
            <span className="text-xs text-gray-300 font-mono">{formatTime(remain)}</span>
          </div>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="text-[11px] text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        {/* Thin progress bar */}
        <div className="mt-1.5 bg-gray-800 rounded-full h-1 overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500/70"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Preset buttons (only when plug is off and no active rule)
  if (!isOn) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-1.5">
          {PRESETS.map(({ label, minutes }) => (
            <button
              key={label}
              onClick={() => handlePreset(minutes)}
              disabled={busy}
              className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-emerald-900/50 hover:text-emerald-400 text-gray-400 border border-gray-700 hover:border-emerald-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Plug is on but no active rule — render nothing
  return null;
}
