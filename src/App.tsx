// src/App.tsx
import { useDevices } from './hooks/useDevices';
import LoginForm from './components/LoginForm';
import Layout from './components/Layout';
import DeviceGrid from './components/DeviceGrid';
import DeviceDetails from './components/DeviceDetails';

function App() {
  const {
    loggedIn,
    loginLoading,
    scanning,
    initializing,
    devices,
    selectedDeviceId,
    error,
    emeterData,
    login,
    logout,
    selectDevice,
    refreshDevices,
    togglePower,
    renameDevice,
    fetchSchedule,
  } = useDevices();

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-5xl animate-pulse">🔌</span>
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <LoginForm
        onSubmit={login}
        loading={loginLoading}
        error={error}
      />
    );
  }

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  return (
    <Layout
      error={error}
      deviceCount={devices.length}
      scanning={scanning}
      onRefresh={refreshDevices}
      onLogout={logout}
    >
      <DeviceGrid
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        scanning={scanning}
        onSelectDevice={selectDevice}
        onTogglePower={togglePower}
      />

      {selectedDevice && (
        <DeviceDetails
          device={selectedDevice}
          onClose={() => selectDevice(null)}
          onRename={renameDevice}
          onSetLedState={async () => {}}
          onReboot={async () => {}}
          fetchSchedule={fetchSchedule}
          emeterData={selectedDeviceId && emeterData[selectedDeviceId]
            ? emeterData[selectedDeviceId]
            : null}
        />
      )}
    </Layout>
  );
}

export default App;
