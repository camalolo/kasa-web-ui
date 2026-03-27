// src/components/Layout.tsx
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  error: string | null;
  deviceCount: number;
  scanning: boolean;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

export default function Layout({
  children,
  error,
  deviceCount,
  scanning,
  onRefresh,
  onLogout,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔌</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Kasa Web UI</h1>
              <p className="text-gray-400 text-xs">TP-Link Smart Plug Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {scanning ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Scanning…
              </span>
            ) : (
              <span className="text-sm text-gray-400">
                {deviceCount} device{deviceCount !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={scanning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:text-emerald-300 disabled:cursor-wait text-white text-sm font-medium rounded-lg transition-colors"
            >
              {scanning ? '⏳ Scanning…' : '🔄 Refresh'}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-6 py-3 text-red-200 text-sm">
          ⚠️ {error}
        </div>
      )}

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
