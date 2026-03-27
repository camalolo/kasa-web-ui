# Kasa Web UI

A web application for managing TP-Link Tapo smart plugs (KP125M and similar) on a local network.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- Auto-discover Tapo smart plugs on your LAN
- Power toggle (on/off) with real-time state
- Energy monitoring (power, voltage, current, total consumption)
- Device information and management
- Encrypted credential persistence (session-scoped auto-login)
- Dark theme UI, responsive grid layout
- Network scanning progress indicator

## Prerequisites

- Node.js >= 18
- TP-Link Tapo account (email + password)
- Tapo smart plugs on the same LAN as the machine running the server

## Getting Started

```bash
npm install
npm run dev
```

The Vite dev server binds to `0.0.0.0:5173` so you can access it from other machines on your LAN (e.g. `http://192.168.1.x:5173`). The Express backend listens on `localhost:3001` and Vite proxies `/api` and `/ws` requests to it.

## Architecture

```
kasa-web-ui/
├── server/                    # Express backend
│   ├── index.ts               # Entry point (port 3001)
│   ├── kasa.ts                # Tapo cloud login, local control, device management
│   ├── routes/
│   │   └── devices.ts         # REST API endpoints (auth + devices)
│   └── ws.ts                  # WebSocket connection management
├── src/                       # React frontend
│   ├── api/
│   │   └── client.ts          # API client (fetch-based)
│   ├── components/
│   │   ├── DeviceCard.tsx     # Individual plug card
│   │   ├── DeviceDetails.tsx  # Slide-out details panel
│   │   ├── DeviceGrid.tsx     # Card grid with scan indicator
│   │   ├── EnergyMonitor.tsx  # Energy data display
│   │   ├── Layout.tsx         # App shell (header, error bar)
│   │   ├── LoginForm.tsx      # TP-Link credential login
│   │   └── ScheduleList.tsx   # Schedule list placeholder
│   ├── hooks/
│   │   ├── useDevices.ts      # Main state management hook
│   │   └── useWebSocket.ts    # Auto-reconnecting WebSocket
│   ├── types/
│   │   └── device.ts          # Shared TypeScript types
│   ├── utils/
│   │   └── crypto.ts          # AES-256-CBC credential encryption (aes-js)
│   ├── App.tsx                # Root component
│   ├── index.css              # Tailwind + custom styles
│   └── main.tsx               # React entry point
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── tsconfig.json
```

## How It Works

1. **Authentication**: You sign in with your TP-Link Tapo cloud credentials. Credentials are encrypted with AES-256-CBC (using `aes-js`) and stored in `localStorage`. The encryption key lives in `sessionStorage` — so auto-login works on CTRL-F5 in the same tab but requires full login in a new tab.

2. **Device Discovery**: The backend calls the Tapo cloud API to list your registered devices, then resolves each device's MAC address to a LAN IP via `/proc/net/arp` (with broadcast ping fallback). It connects locally to each plug using the KLAP protocol to get real-time power state and energy data.

3. **Local Control**: All device operations (power toggle, energy queries, device info) happen over your LAN via direct connections to the plugs. No cloud round-trip after initial discovery.

## Production Build

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USER/kasa-web-ui.git
cd kasa-web-ui
npm install
```

### 2. Adjust configuration

Edit `vite.config.ts` — set `outDir` to wherever you want the static files served from on your system:

```ts
build: {
  outDir: '/path/to/your/web/root/plugs',
  emptyOutDir: true,
}
```

### 3. Build

```bash
npm run build
```

This runs TypeScript checks (`tsc -b`) then Vite build. Output goes to the `outDir` you configured.

### 4. Configure nginx

Add these location blocks inside your HTTPS server block (adjust paths to match your `outDir`):

```nginx
location /plugs/api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /plugs/ws {
    proxy_pass http://127.0.0.1:3001/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /plugs/ {
    alias /path/to/your/web/root/plugs/;
    try_files $uri $uri/ /plugs/index.html;
}
```

Reload nginx:

```bash
sudo nginx -t && sudo nginx -s reload
```

### 5. Set up systemd service

Create `/etc/systemd/system/kasa-web-ui.service`:

```ini
[Unit]
Description=Kasa Web UI Server
After=network.target

[Service]
ExecStart=/usr/local/bin/npx tsx server/index.ts
User=YOUR_USER
WorkingDirectory=/path/to/kasa-web-ui
Environment="HOME=/home/YOUR_USER" "USER=YOUR_USER" "NODE_ENV=production" "PORT=3001"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust `User`, `WorkingDirectory`, and paths as needed. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable kasa-web-ui.service
sudo systemctl start kasa-web-ui.service
```

Check status:

```bash
sudo systemctl status kasa-web-ui.service
```

## Script Reference

| Command | Description |
|---|---|
| `npm run dev` | Start both backend and frontend concurrently |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express backend only (with tsx watch) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run start` | Run the backend server (for use with systemd) |
| `npm run preview` | Preview production build |

## Notes

- Only tested with Tapo P110M/KP125M plugs. Other Tapo devices may work but are untested.
- LED control, schedule management, and device reboot are not supported by the `tp-link-tapo-connect` library for local control.
- The Vite proxy configuration forwards `/api` and `/ws` to the Express backend.
