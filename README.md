# Kasa Web UI

A web application for managing TP-Link Tapo smart plugs (KP125M) on a local network.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- Auto-discover Tapo smart plugs on your LAN via cloud device list + ARP resolution
- Power toggle (on/off) with real-time state polling
- Energy monitoring (current power, daily/monthly consumption, runtime)
- Schedule management (create, edit, delete, toggle enable, bulk on/off)
- Countdown timer (set a plug to turn on/off after a delay)
- Away mode (anti-theft random on/off simulation)
- Device rename
- Encrypted credential persistence (session-scoped auto-login)
- Dark theme UI, responsive grid layout

## Prerequisites

- Node.js >= 18
- TP-Link Tapo account (email + password)
- Tapo smart plugs on the same LAN as the machine running the server

## Quick Start

```bash
npm install
npm run dev
```

The Vite dev server binds to `0.0.0.0:5173`. The Express backend listens on `localhost:3001` and Vite proxies `/api` and `/ws` requests to it.

## Architecture

```
kasa-web-ui/
├── server/                    # Express backend
│   ├── index.ts               # Entry point (port 3001)
│   ├── kasa.ts                # Tapo cloud login, local control, schedules, timers
│   ├── tapo-protocol.ts       # Raw KLASP + passthrough transport with session retry
│   ├── logger.ts              # Structured logger with levels and context tags
│   ├── request-logger.ts      # HTTP request logging middleware
│   ├── routes/
│   │   └── devices.ts         # REST API endpoints
│   └── ws.ts                  # WebSocket connection management
├── src/                       # React frontend
│   ├── api/
│   │   └── client.ts          # API client (fetch-based)
│   ├── components/
│   │   ├── DeviceCard.tsx     # Plug card with power toggle
│   │   ├── DeviceDetails.tsx  # Tabbed details panel (Info/Energy/Schedules/Timer/Away)
│   │   ├── DeviceGrid.tsx     # Card grid with scan indicator
│   │   ├── EnergyMonitor.tsx  # Energy data display
│   │   ├── CountdownTimer.tsx # Countdown timer with local extrapolation
│   │   ├── AwayMode.tsx       # Away mode (anti-theft) UI
│   │   ├── ScheduleList.tsx   # Schedule CRUD UI
│   │   ├── Layout.tsx         # App shell (header, error bar)
│   │   └── LoginForm.tsx      # TP-Link credential login
│   ├── hooks/
│   │   └── useDevices.ts      # Main state management hook
│   ├── types/
│   │   └── device.ts          # Shared TypeScript types
│   ├── utils/
│   │   └── crypto.ts          # AES-256-CBC credential encryption (aes-js)
│   ├── App.tsx                # Root component
│   ├── index.css              # Tailwind + custom styles
│   └── main.tsx               # React entry point
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## How It Works

1. **Authentication**: Sign in with your TP-Link Tapo cloud credentials. Credentials are encrypted with AES-256-CBC (`aes-js`) and stored in `localStorage`. The encryption key lives in `sessionStorage` — auto-login works on CTRL-F5 in the same tab but requires full login in a new tab.

2. **Device Discovery**: The backend calls the Tapo cloud API to list registered devices, then resolves each MAC to a LAN IP via `/proc/net/arp` (with broadcast ping fallback). It connects locally using the KLASP handshake protocol.

3. **Local Control**: All operations (power toggle, energy queries, schedules, timers) go over your LAN via direct connections to the plugs. No cloud round-trip after initial discovery. Uses a custom KLASP transport for raw protocol access since the `tp-link-tapo-connect` library only exposes basic operations.

4. **Real-time Updates**: Device power state polls every 5 seconds for all devices, keeping card toggles in sync with external changes (e.g. physical button, Kasa app).

## Production Build

### 1. Clone and install

```bash
git clone https://github.com/camalolo/kasa-web-ui.git
cd kasa-web-ui
npm install
```

### 2. Build

```bash
npm run build:prod
```

This sets the output directory to `/home/www/public/camalolo/plugs/` and runs TypeScript checks + Vite build. Adjust the path in the `build:prod` script in `package.json` for your system.

### 3. Configure nginx

Add these location blocks inside your HTTPS server block:

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
    alias /home/www/public/camalolo/plugs/;
    try_files $uri $uri/ /plugs/index.html;
}
```

### 4. Set up systemd service

Create `/etc/systemd/system/kasa-web-ui.service`:

```ini
[Unit]
Description=Kasa Web UI Server
After=network.target

[Service]
ExecStart=/usr/local/bin/npx tsx server/index.ts
User=YOUR_USER
WorkingDirectory=/path/to/kasa-web-ui
Environment="HOME=/home/YOUR_USER" "USER=YOUR_USER" "NODE_ENV=production" "PORT=3001" "LOG_LEVEL=debug"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable kasa-web-ui.service
sudo systemctl start kasa-web-ui.service
```

### Deploy

```bash
npm run build:prod
sudo systemctl restart kasa-web-ui
```

## Script Reference

| Command | Description |
|---|---|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express backend only (with tsx watch) |
| `npm run build:prod` | TypeScript check + production build |
| `npm run start` | Run the backend server |

## Known Limitations

- Only tested with KP125M plugs. Other Tapo devices may work but are untested.
- Only one countdown timer at a time (device firmware limit).
- No historical energy data from local protocol — only aggregate totals.
- Device rename is local-only, not synced to cloud.
- Away mode writes via local protocol are untested.
