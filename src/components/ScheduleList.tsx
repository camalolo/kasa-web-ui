import { useState, useEffect, useCallback } from 'react';
import type { TapoScheduleRule, ScheduleRulesResponse } from '../types/device';

interface ScheduleListProps {
  deviceId: string;
  fetchScheduleRules: (id: string) => Promise<ScheduleRulesResponse>;
  addSchedule: (id: string, rule: { smin: number; sact: string; eact?: string; emin?: number; repeat: number[] }) => Promise<void>;
  editSchedule: (id: string, ruleId: string, rule: { smin: number; sact: string; eact?: string; emin?: number; repeat: number[]; enable: boolean }) => Promise<void>;
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

interface ScheduleForm {
  smin: number;
  sact: string;
  eact: string;
  emin: number;
  repeat: number[];
}

const EMPTY_FORM: ScheduleForm = {
  smin: 480,
  sact: 'on',
  eact: 'none',
  emin: 0,
  repeat: [0, 1, 2, 3, 4, 5, 6],
};

function ruleToForm(rule: TapoScheduleRule): ScheduleForm {
  return {
    smin: rule.smin,
    sact: rule.sact,
    eact: rule.eact ?? 'none',
    emin: rule.emin ?? 0,
    repeat: rule.repeat ?? [],
  };
}

export default function ScheduleList({
  deviceId,
  fetchScheduleRules,
  addSchedule,
  editSchedule,
  deleteSchedule,
  toggleAllSchedules,
}: ScheduleListProps) {
  const [rules, setRules] = useState<TapoScheduleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TapoScheduleRule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [schedulesEnabled, setSchedulesEnabled] = useState(true);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScheduleRules(deviceId);
      setRules(data.rule_list ?? []);
      setSchedulesEnabled(data.enable ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    }
    setLoading(false);
  }, [deviceId, fetchScheduleRules]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    try {
      await addSchedule(deviceId, {
        smin: form.smin,
        sact: form.sact,
        eact: form.eact !== 'none' ? form.eact : undefined,
        emin: form.emin > 0 ? form.emin : undefined,
        repeat: form.repeat,
      });
      setShowAddForm(false);
      setForm(EMPTY_FORM);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add schedule');
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editingRule) return;
    setSaving(true);
    setError(null);
    try {
      await editSchedule(deviceId, editingRule.id, {
        smin: form.smin,
        sact: form.sact,
        eact: form.eact !== 'none' ? form.eact : undefined,
        emin: form.emin > 0 ? form.emin : undefined,
        repeat: form.repeat,
        enable: editingRule.enable,
      });
      setEditingRule(null);
      setForm(EMPTY_FORM);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit schedule');
    }
    setSaving(false);
  };

  const handleDisable = async (rule: TapoScheduleRule) => {
    setSaving(true);
    setError(null);
    try {
      await deleteSchedule(deviceId, rule.id);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
    setSaving(false);
  };

  const handleToggleEnable = async (rule: TapoScheduleRule) => {
    setSaving(true);
    setError(null);
    try {
      await editSchedule(deviceId, rule.id, {
        smin: rule.smin,
        sact: rule.sact,
        eact: rule.eact,
        emin: rule.emin,
        repeat: rule.repeat,
        enable: !rule.enable,
      });
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
    setSaving(false);
  };

  const handleToggleAll = async () => {
    setSaving(true);
    setError(null);
    try {
      await toggleAllSchedules(deviceId, !schedulesEnabled);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle all schedules');
    }
    setSaving(false);
  };

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const newRepeat = prev.repeat.includes(day)
        ? prev.repeat.filter((d) => d !== day)
        : [...prev.repeat, day].sort();
      return { ...prev, repeat: newRepeat };
    });
  };

  const startEdit = (rule: TapoScheduleRule) => {
    setEditingRule(rule);
    setForm(ruleToForm(rule));
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setShowAddForm(false);
    setForm(EMPTY_FORM);
  };

  const isEditing = showAddForm || editingRule !== null;

  const renderForm = (title: string, onSave: () => void, saveLabel: string) => (
    <div className="bg-gray-900/70 border border-emerald-800/50 rounded-lg p-3 mb-3">
      <h4 className="text-xs font-semibold text-emerald-400 mb-2">{title}</h4>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Action</label>
          <select
            value={form.sact}
            onChange={(e) => setForm((p) => ({ ...p, sact: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
          >
            <option value="on">Turn On</option>
            <option value="off">Turn Off</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Time</label>
          <input
            type="time"
            value={formatMinutes(form.smin)}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              if (h !== undefined && m !== undefined) {
                setForm((p) => ({ ...p, smin: h * 60 + m }));
              }
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mb-2">
        <label className="block text-[10px] text-gray-500 mb-1">Repeat</label>
        <div className="flex gap-1">
          {DAY_NAMES.map((day, i) => (
            <button
              key={day}
              onClick={() => toggleDay(i)}
              className={`w-8 h-8 rounded text-[10px] font-medium transition-colors ${
                form.repeat.includes(i)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
            >
              {day.charAt(0)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded px-3 py-1.5 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saveLabel}
        </button>
        <button
          onClick={cancelEdit}
          disabled={saving}
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <span>📅</span> Schedules
          <span className="text-xs text-gray-500 font-normal">({rules.filter((r) => r.enable).length}/{rules.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAll}
            disabled={saving}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              schedulesEnabled
                ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900/80'
                : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
            }`}
            title={schedulesEnabled ? 'Disable all schedules' : 'Enable all schedules'}
          >
            {schedulesEnabled ? 'All On' : 'All Off'}
          </button>
          <button
            onClick={loadSchedules}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? '...' : '🔄'}
          </button>
          <button
            onClick={() => { setShowAddForm(true); setEditingRule(null); setForm(EMPTY_FORM); }}
            disabled={isEditing || saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-0.5 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/30 rounded-lg px-3 py-2 mb-3">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {showAddForm && renderForm('Add Schedule', handleAdd, 'Add Schedule')}
      {editingRule && renderForm(`Edit Schedule ${editingRule.id}`, handleEdit, 'Save')}

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
          <p className="text-sm mb-1">No schedules configured</p>
          <p className="text-xs text-gray-600">Tap + Add to create one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-gray-900/50 rounded-lg px-4 py-3 border ${
                rule.enable ? 'border-gray-700/50' : 'border-gray-800/30 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleEnable(rule)}
                    disabled={saving}
                    className="text-sm"
                    title={rule.enable ? 'Disable' : 'Enable'}
                  >
                    {rule.sact === 'on' ? (rule.enable ? '🟢' : '⭕') : (rule.enable ? '🔴' : '⭕')}
                  </button>
                  <span className={`text-sm font-medium ${rule.enable ? '' : 'text-gray-500'}`}>
                    {rule.sact === 'on' ? 'Turn On' : 'Turn Off'}
                  </span>
                  <span className={`text-sm ${rule.enable ? 'text-gray-400' : 'text-gray-600'}`}>
                    at {formatMinutes(rule.smin)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(rule)}
                    disabled={saving || isEditing}
                    className="text-xs text-gray-500 hover:text-white px-1.5 py-0.5 rounded transition-colors disabled:opacity-30"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDisable(rule)}
                    disabled={saving || isEditing}
                    className="text-xs text-gray-500 hover:text-red-400 px-1.5 py-0.5 rounded transition-colors disabled:opacity-30"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className={`text-xs ml-6 ${rule.enable ? 'text-gray-400' : 'text-gray-600'}`}>
                📅 {formatRepeat(rule.repeat)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
