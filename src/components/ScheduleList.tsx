import { useState, useEffect, useCallback } from 'react';
import type { TapoScheduleRule, ScheduleRulesResponse } from '../types/device';

interface ScheduleListProps {
  deviceId: string;
  fetchScheduleRules: (id: string) => Promise<ScheduleRulesResponse>;
  addSchedule: (id: string, rule: { name: string; smin: number; sact: string; eact?: string; emin?: number; repeat: number[] }) => Promise<void>;
  editSchedule: (id: string, ruleId: string, updates: Record<string, unknown>) => Promise<void>;
  deleteSchedule: (id: string, ruleId: string) => Promise<void>;
  toggleAllSchedules: (id: string, enable: boolean) => Promise<void>;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatRepeat(repeat: number[]): string {
  if (!repeat || repeat.length === 0) return 'Once';
  if (repeat.length === 7) return 'Every day';
  const days = DAY_NAMES.filter((_, i) => repeat.includes(i));
  return days.join(', ');
}

interface FormData {
  name: string;
  sact: string;
  shour: string;
  smin: string;
  hasEndAction: boolean;
  eact: string;
  ehour: string;
  emin: string;
  repeat: boolean[];
}

const EMPTY_FORM: FormData = {
  name: 'Schedule',
  sact: 'on',
  shour: '08',
  smin: '00',
  hasEndAction: false,
  eact: 'off',
  ehour: '09',
  emin: '00',
  repeat: [false, true, true, true, true, true, false],
};

export default function ScheduleList({
  deviceId,
  fetchScheduleRules,
  addSchedule,
  editSchedule,
  deleteSchedule,
  toggleAllSchedules,
}: ScheduleListProps) {
  const [rules, setRules] = useState<TapoScheduleRule[]>([]);
  const [allEnabled, setAllEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TapoScheduleRule | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScheduleRules(deviceId);
      setRules(data.rule_list ?? []);
      setAllEnabled(data.enable ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    }
    setLoading(false);
  }, [deviceId, fetchScheduleRules]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  function openAddForm() {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setShowAddForm(true);
  }

  function openEditForm(rule: TapoScheduleRule) {
    setEditingRule(rule);
    const startH = Math.floor(rule.smin / 60);
    const startM = rule.smin % 60;
    const hasEnd = rule.eact != null && rule.emin != null;
    const endH = hasEnd ? Math.floor((rule.emin ?? 0) / 60) : 9;
    const endM = hasEnd ? (rule.emin ?? 0) % 60 : 0;
    setForm({
      name: rule.name ?? 'Schedule',
      sact: rule.sact ?? 'on',
      shour: startH.toString().padStart(2, '0'),
      smin: startM.toString().padStart(2, '0'),
      hasEndAction: hasEnd,
      eact: rule.eact ?? 'off',
      ehour: endH.toString().padStart(2, '0'),
      emin: endM.toString().padStart(2, '0'),
      repeat: DAY_NAMES.map((_, i) => (rule.repeat ?? []).includes(i)),
    });
    setShowAddForm(true);
  }

  function cancelForm() {
    setShowAddForm(false);
    setEditingRule(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const sminTotal = parseInt(form.shour, 10) * 60 + parseInt(form.smin, 10);
      const repeatDays = form.repeat.reduce<number[]>((acc, val, i) => {
        if (val) acc.push(i);
        return acc;
      }, []);

      const payload = {
        name: form.name.trim() || 'Schedule',
        smin: sminTotal,
        sact: form.sact,
        eact: form.hasEndAction ? form.eact : undefined,
        emin: form.hasEndAction
          ? parseInt(form.ehour, 10) * 60 + parseInt(form.emin, 10)
          : undefined,
        repeat: repeatDays,
      };

      if (editingRule) {
        await editSchedule(deviceId, editingRule.id, payload);
      } else {
        await addSchedule(deviceId, payload);
      }
      cancelForm();
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    }
    setSubmitting(false);
  }

  async function handleToggleRule(rule: TapoScheduleRule) {
    try {
      await editSchedule(deviceId, rule.id, { enable: !rule.enable });
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm('Delete this schedule? This cannot be undone.')) return;
    try {
      await deleteSchedule(deviceId, ruleId);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  }

  async function handleToggleAll(enabled: boolean) {
    try {
      await toggleAllSchedules(deviceId, enabled);
      setAllEnabled(enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle all schedules');
    }
  }

  function toggleDay(index: number) {
    setForm((prev) => ({
      ...prev,
      repeat: prev.repeat.map((v, i) => (i === index ? !v : v)),
    }));
  }

  const isFormVisible = showAddForm || editingRule != null;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <span>📅</span> Schedules
          <span className="text-xs text-gray-500 font-normal">({rules.length})</span>
        </h3>
        <div className="flex items-center gap-3">
          {!loading && rules.length > 0 && (
            <div
              className={`toggle-switch ${allEnabled ? 'on' : 'off'}`}
              onClick={() => handleToggleAll(!allEnabled)}
              title={allEnabled ? 'Disable all schedules' : 'Enable all schedules'}
            >
              <div className="toggle-knob" />
            </div>
          )}
          <button
            onClick={loadSchedules}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : '🔄'}
          </button>
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-700/50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-600 rounded w-24 mb-2" />
              <div className="h-3 bg-gray-600 rounded w-32" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 && !isFormVisible ? (
        <div className="text-center py-6 text-gray-500">
          <span className="text-3xl block mb-2">📅</span>
          <p className="text-sm mb-3">No schedules configured</p>
          <button
            onClick={openAddForm}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            + Add Schedule
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
                  <span className="text-sm">
                    {rule.sact === 'on' ? '🟢' : '🔴'}
                  </span>
                  <span className="text-sm font-medium">
                    {rule.sact === 'on' ? 'Turn On' : 'Turn Off'}
                  </span>
                  <span className="text-sm text-gray-400">
                    at {formatMinutes(rule.smin)}
                  </span>
                  {rule.eact != null && rule.emin != null && (
                    <span className="text-xs text-gray-500">
                      until {rule.eact === 'on' ? '🟢' : '🔴'} {formatMinutes(rule.emin)}
                    </span>
                  )}
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
                <div>📅 {formatRepeat(rule.repeat)}</div>
                {rule.name && rule.name !== '' && <div>📝 {rule.name}</div>}
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <div
                  className={`toggle-switch ${rule.enable ? 'on' : 'off'}`}
                  onClick={() => handleToggleRule(rule)}
                >
                  <div className="toggle-knob" />
                </div>
                <button
                  onClick={() => openEditForm(rule)}
                  className="text-xs text-gray-400 hover:text-white transition-colors px-1"
                  title="Edit"
                >
                  ✏️
                </button>
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

          {!isFormVisible && (
            <button
              onClick={openAddForm}
              className="w-full text-sm text-emerald-400 hover:text-emerald-300 hover:bg-gray-800/50 rounded-lg py-2 transition-colors"
            >
              + Add Schedule
            </button>
          )}
        </div>
      )}

      {isFormVisible && (
        <div className="mt-3 bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
          <h4 className="text-sm font-semibold text-gray-300">
            {editingRule ? 'Edit Schedule' : 'Add Schedule'}
          </h4>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Schedule"
              maxLength={32}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Action</label>
              <select
                value={form.sact}
                onChange={(e) => setForm((p) => ({ ...p, sact: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="on">🟢 Turn On</option>
                <option value="off">🔴 Turn Off</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Time</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={form.shour}
                  onChange={(e) => setForm((p) => ({ ...p, shour: e.target.value.padStart(2, '0') }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-emerald-500"
                />
                <span className="text-gray-500">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={form.smin}
                  onChange={(e) => setForm((p) => ({ ...p, smin: e.target.value.padStart(2, '0') }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasEndAction}
                onChange={(e) => setForm((p) => ({ ...p, hasEndAction: e.target.checked }))}
                className="rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-xs text-gray-400">Set end action (optional)</span>
            </label>
          </div>

          {form.hasEndAction && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Action</label>
                <select
                  value={form.eact}
                  onChange={(e) => setForm((p) => ({ ...p, eact: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="on">🟢 Turn On</option>
                  <option value="off">🔴 Turn Off</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Time</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={form.ehour}
                    onChange={(e) => setForm((p) => ({ ...p, ehour: e.target.value.padStart(2, '0') }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-gray-500">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={form.emin}
                    onChange={(e) => setForm((p) => ({ ...p, emin: e.target.value.padStart(2, '0') }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-2">Repeat</label>
            <div className="flex gap-1">
              {DAY_NAMES.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`flex-1 text-xs rounded-lg py-1.5 transition-colors ${
                    form.repeat[i]
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingRule
                  ? 'Update Schedule'
                  : 'Add Schedule'}
            </button>
            <button
              onClick={cancelForm}
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
