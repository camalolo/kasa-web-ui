import { useState, useEffect, useCallback } from 'react';
import type { EmeterData, EnergyData } from '../types/device';

interface EnergyMonitorProps {
  deviceId: string;
  realtimeData: EmeterData | null;
  realtimeLoading?: boolean;
  timeUsage?: { today: string; past7: string; past30: string } | null;
  energyHistory: EnergyData;
  energyLoading?: boolean;
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  fetchEnergyData: (id: string, year: number, month: number) => Promise<EnergyData>;
}

function formatRuntime(minutesStr: string): string {
  const totalMin = parseInt(minutesStr, 10) || 0;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatPower(power: number): string {
  return power < 10 ? power.toFixed(2) : power.toFixed(1);
}

function formatCurrent(current: number): { value: string; unit: string } {
  if (current < 1) {
    return { value: (current * 1000).toFixed(0), unit: 'mA' };
  }
  return { value: current.toFixed(3), unit: 'A' };
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function MetricCardSkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-16 mx-auto mb-1" />
      <div className="h-3 bg-gray-700 rounded w-10 mx-auto" />
    </div>
  );
}

export default function EnergyMonitor({
  deviceId,
  realtimeData,
  realtimeLoading = false,
  timeUsage,
  energyHistory,
  energyLoading = false,
  selectedMonth,
  onMonthChange,
  fetchEnergyData,
}: EnergyMonitorProps) {
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (localLoading || energyLoading) return;
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth() + 1;
    const current = energyHistory.day_list.find(
      (d) => d.time.startsWith(`${year}-${String(month).padStart(2, '0')}`)
    );
    if (!current) {
      setLocalLoading(true);
      fetchEnergyData(deviceId, year, month).finally(() => setLocalLoading(false));
    }
  }, [deviceId, selectedMonth, fetchEnergyData, energyHistory, energyLoading, localLoading]);

  const handlePrevMonth = useCallback(() => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  }, [selectedMonth, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  }, [selectedMonth, onMonthChange]);

  const daysInMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  ).getDate();

  const now = new Date();
  const isCurrentMonth =
    selectedMonth.getFullYear() === now.getFullYear() &&
    selectedMonth.getMonth() === now.getMonth();
  const todayDate = now.getDate();

  const dayData = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const entry = energyHistory.day_list.find((d) => d.time === dateStr);
    return { day: dayNum, value: entry?.value ?? 0 };
  });

  const maxValue = Math.max(...dayData.map((d) => d.value), 0.001);
  const monthTotal = dayData.reduce((sum, d) => sum + d.value, 0);
  const monthTotalKwh = (monthTotal / 1000).toFixed(2);

  const recentMonths = energyHistory.month_list
    .slice()
    .sort((a, b) => {
      const dateA = new Date(a.time + '-01');
      const dateB = new Date(b.time + '-01');
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 6);

  const metrics: { label: string; value: string; unit: string; color: string; icon: string }[] = realtimeData ? [
    {
      label: 'Power',
      value: formatPower(realtimeData.power),
      unit: 'W',
      color: 'text-yellow-400',
      icon: '\u26A1',
    },
    {
      label: 'Voltage',
      value: realtimeData.voltage.toFixed(1),
      unit: 'V',
      color: 'text-blue-400',
      icon: '\uD83D\uDD0B',
    },
    {
      label: 'Current',
      ...formatCurrent(realtimeData.current),
      color: 'text-purple-400',
      icon: '\u301C\uFE0F',
    },
    {
      label: 'Total',
      value: realtimeData.total.toFixed(3),
      unit: 'kWh',
      color: 'text-emerald-400',
      icon: '\uD83D\uDCCA',
    },
  ] : [];

  const isLoading = realtimeLoading || !realtimeData;
  const isChartLoading = energyLoading || localLoading;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span>\u26A1</span> Energy Monitor
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-lg mb-0.5">{metric.icon}</div>
                  <div className={`text-lg font-bold ${metric.color}`}>
                    {metric.value}
                    <span className="text-xs font-normal text-gray-500 ml-1">{metric.unit}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{metric.label}</div>
                </div>
              ))}
            </div>
            {realtimeData.powerFactor !== undefined && (
              <div className="mt-3 text-center text-xs text-gray-500">
                Power Factor: {realtimeData.powerFactor.toFixed(2)}
              </div>
            )}
          </>
        )}
      </div>

      {timeUsage && (
        <div className="bg-gray-800/50 rounded-xl p-4 border-t border-gray-800 pt-4 mt-4">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>\u23F1\uFE0F</span> Runtime
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg mb-0.5">{'\u23F1\uFE0F'}</div>
              <div className="text-sm font-semibold text-gray-300">{formatRuntime(timeUsage.today)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Today</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg mb-0.5">{'\uD83D\uDCC5'}</div>
              <div className="text-sm font-semibold text-gray-300">{formatRuntime(timeUsage.past7)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Past 7 days</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg mb-0.5">{'\uD83D\uDCCA'}</div>
              <div className="text-sm font-semibold text-gray-300">{formatRuntime(timeUsage.past30)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Past 30 days</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800/50 rounded-xl p-4 border-t border-gray-800 pt-4 mt-4">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>{'\uD83D\uDCC5'}</span> Energy History
        </h4>

        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrevMonth}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors"
          >
            {'\u2039'}
          </button>
          <span className="text-sm font-medium text-gray-300">
            {MONTH_LABELS[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
          </span>
          <button
            onClick={handleNextMonth}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors"
          >
            {'\u203A'}
          </button>
        </div>

        {isChartLoading ? (
          <div className="flex items-end gap-0.5 h-40 animate-pulse">
            {Array.from({ length: daysInMonth }).map((_, i) => (
              <div key={i} className="flex-1 bg-gray-700 rounded-t" style={{ height: `${Math.random() * 80 + 10}%` }} />
            ))}
          </div>
        ) : dayData.every((d) => d.value === 0) ? (
          <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
            No energy data available
          </div>
        ) : (
          <div className="flex items-end gap-0.5 h-40">
            {dayData.map((day) => {
              const pct = day.value > 0 ? (day.value / maxValue) * 100 : 0;
              const isToday = isCurrentMonth && day.day === todayDate;
              return (
                <div key={day.day} className="flex-1 flex flex-col items-center justify-end h-full">
                  {day.value > 0 && (
                    <span className="text-[9px] text-gray-400 mb-0.5 whitespace-nowrap">
                      {day.value}
                    </span>
                  )}
                  {day.value > 0 ? (
                    <div
                      className={`w-full rounded-t min-h-[2px] ${isToday ? 'bg-emerald-400' : 'bg-emerald-500/70'}`}
                      style={{ height: `${pct}%` }}
                    />
                  ) : (
                    <div className="w-full min-h-[2px]" />
                  )}
                  <span className="text-[8px] text-gray-500 mt-0.5">{day.day}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 text-right text-xs text-gray-400">
          Total: {monthTotalKwh} kWh
        </div>
      </div>

      {recentMonths.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 border-t border-gray-800 pt-4 mt-4">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{'\uD83D\uDCCA'}</span> Monthly Totals
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {recentMonths.map((m) => {
              const kwh = (m.value / 1000).toFixed(2);
              const parts = m.time.split('-');
              const year = parts[0] ?? '2026';
              const month = parts[1] ?? '1';
              const label = `${MONTH_LABELS[parseInt(month, 10) - 1] ?? 'Jan'} ${year.slice(2)}`;
              return (
                <div key={m.time} className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <div className="text-[11px] font-semibold text-gray-300">{kwh}</div>
                  <div className="text-[10px] text-gray-500">kWh</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
