import type { EmeterData } from '../types/device';

interface EnergyMonitorProps {
  realtimeData: EmeterData | null;
  realtimeLoading?: boolean;
  timeUsage?: { today: string; past7: string; past30: string } | null;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatRuntimeStr(minutesStr: string): string {
  return formatRuntime(parseInt(minutesStr, 10) || 0);
}

function formatWh(wh: number): string {
  if (wh >= 1000) return `${(wh / 1000).toFixed(2)} kWh`;
  return `${wh} Wh`;
}

function MetricCardSkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-16 mx-auto mb-1" />
      <div className="h-3 bg-gray-700 rounded w-10 mx-auto" />
    </div>
  );
}

export default function EnergyMonitor({
  realtimeData,
  realtimeLoading = false,
  timeUsage,
}: EnergyMonitorProps) {
  const isLoading = realtimeLoading || !realtimeData;

  const metrics: { label: string; value: string; unit: string; color: string; icon: string }[] = realtimeData ? [
    {
      label: 'Current Power',
      value: realtimeData.power.toFixed(1),
      unit: 'W',
      color: 'text-yellow-400',
      icon: '\u26A1',
    },
    {
      label: 'Today',
      value: formatWh(realtimeData.todayEnergy),
      unit: '',
      color: 'text-emerald-400',
      icon: '\uD83D\uDCC5',
    },
    {
      label: 'This Month',
      value: formatWh(realtimeData.monthEnergy),
      unit: '',
      color: 'text-blue-400',
      icon: '\uD83D\uDCCA',
    },
    {
      label: 'Runtime Today',
      value: formatRuntime(realtimeData.todayRuntime),
      unit: '',
      color: 'text-purple-400',
      icon: '\u23F1\uFE0F',
    },
  ] : [];

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
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-gray-900/50 rounded-lg p-3 text-center">
                <div className="text-lg mb-0.5">{metric.icon}</div>
                <div className={`text-lg font-bold ${metric.color}`}>
                  {metric.value}
                  {metric.unit && (
                    <span className="text-xs font-normal text-gray-500 ml-1">{metric.unit}</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">{metric.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {realtimeData?.localTime && (
        <div className="text-center text-xs text-gray-600">
          Device time: {realtimeData.localTime}
        </div>
      )}

      {timeUsage && (
        <div className="bg-gray-800/50 rounded-xl p-4 border-t border-gray-800 pt-4 mt-4">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>\u23F1\uFE0F</span> Runtime History
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg mb-0.5">{'\u23F1\uFE0F'}</div>
              <div className="text-sm font-semibold text-gray-300">{formatRuntimeStr(timeUsage.today)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Today</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg mb-0.5">{'\uD83D\uDCC5'}</div>
              <div className="text-sm font-semibold text-gray-300">{formatRuntimeStr(timeUsage.past7)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Past 7 days</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg mb-0.5">{'\uD83D\uDCCA'}</div>
              <div className="text-sm font-semibold text-gray-300">{formatRuntimeStr(timeUsage.past30)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Past 30 days</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
