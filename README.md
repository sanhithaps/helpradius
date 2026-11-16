# Help Radius 🚨
### Location-Based Emergency and Community Assistance Platform

[![CI/CD Pipeline](https://github.com/help-radius/help-radius/actions/workflows/ci.yml/badge.svg)](https://github.com/help-radius/help-radius/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/node-v20%20LTS-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

**Help Radius** connects individuals in immediate distress or everyday need with nearby verified volunteers and emergency first-responders using GPS geofencing, real-time Socket.io streaming, OSRM road routing, WebRTC voice calling, and privacy-preserving communication.

---

## 🌟 Feature Status & Architecture

| Feature | Status | Details & Implementation |
| :--- | :---: | :--- |
| **Password Hashing & Security** | ✅ **Working** | `bcryptjs` with 10 salt rounds, cryptographic JWT secret in `.env`, masked verification IDs (`XXXX-XXXX-last4`), and atomic data store writes. |
| **Real-Time Bidirectional Sync** | ✅ **Working** | **Socket.io** event streaming (`chat:send`, `chat:typing`, `chat:read`, `request:new`, `request:taken`, `request:updated`, `notification:new`). HTTP polling completely removed. |
| **Live GPS Streaming** | ✅ **Working** | Helper `watchPosition` streaming throttled to 3s / 10m intervals, broadcast to private request room. |
| **Turn-by-Turn Road Routing** | ✅ **Working** | OSRM road-snapped GeoJSON polylines with 5s timeout and Haversine straight-line fallback. |
| **WebRTC Audio Calling** | ✅ **Working** | Real WebRTC audio call stream with Google STUN (`stun:stun.l.google.com:19302`) and Socket.io signaling. Simulated beep removed. |
| **Emergency SOS (Press & Hold)** | ✅ **Working** | 2-second hold protection, 5-second countdown with cancel option, and 112 hotline shortcut. |
| **Cellular SMS Dispatch** | 🟡 **Honest Status** | **Simulated unless Twilio credentials are set** in `.env` (never labelled "delivered" without real telecom dispatch). Supports retry endpoint. |
| **Browser System Notifications** | ✅ **Working** | In-app toasts + HTML5 `Notification` when tab is backgrounded with audio siren/chime. (*Closed-tab FCM push = future work*). |
| **Helper ID Verification** | 🟡 **Admin Review** | Mandatory verification ID on registration; reviewed manually via Admin Panel. ID masked for privacy. |
| **Transparent Pricing** | ✅ **Working** | 3-tier itemized breakdown (Expansion Fee, Travel Comp, Reward). SOS is 100% free & unconditional. |
| **Admin Moderation Panel** | ✅ **Working** | Live metrics, helper approvals, safety certifications, user suspension, and audit trails. |
| **Database Persistence** | 🟡 **Atomic JSON** | Safe atomic file writes (`.tmp` + rename) with sequential write queue. (*MongoDB/PostgreSQL = future work*). |
| **TURN Relaying** | 🟡 **STUN Only** | Direct peer-to-peer WebRTC via public STUN server. (*Symmetric NAT / corporate firewall TURN = future work*). |

---

## 🚀 Getting Started

### 1. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cd backend
cp .env.example .env
```

Your `.env` contains:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=<generated-48-byte-hex-secret>
CORS_ORIGIN=*
SMS_PROVIDER=simulated
ADMIN_EMAIL=admin@helpradius.org
ADMIN_PASSWORD=<your-secure-admin-password>
```

### 2. Password Migration (If upgrading existing database)

If you have existing plaintext records in `backend/data/users.json`, run the one-time migration script:
```bash
cd backend
node scripts/migratePasswords.js
```

### 3. Run Backend (Port 5000)

```bash
cd backend
npm install
npm start
# Server starts on http://localhost:5000 with Socket.io real-time engine
```

### 4. Run Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
# Vite server starts on http://localhost:5173
```

### 5. Mobile & Friend-to-Friend Testing (HTTPS over LAN)

Modern mobile browsers (Chrome on Android, Safari on iOS) **require HTTPS** to allow `navigator.geolocation.watchPosition` and microphone access on local network IPs (e.g., `192.168.x.x`).

Help Radius includes built-in LAN SSL support via `@vitejs/plugin-basic-ssl`:

```bash
cd frontend
# Set VITE_HTTPS=true to run with a trusted local SSL certificate
$env:VITE_HTTPS="true"; npm run dev -- --host
```
Open `https://<YOUR_LAPTOP_LAN_IP>:5173` on your friend's phone or laptop, accept the local self-signed certificate, and live GPS + microphone permissions will work natively!

---

## 🧪 Running Unit Tests

Run the backend automated test runner:

```bash
cd backend
npm test
```

All 16 test suites pass cleanly:
- Haversine Distance spherical trigonometry
- Urban transit speed ETA estimation
- Emergency SOS 100% free pricing rule
- General Help 3-tier pricing & travel compensation
- Emergency contacts 6-contact maximum limit
- Socket.io authentication rejection without token
- Socket.io authentication acceptance with token
- Socket room access control (non-participant rejection)
- Password hashing with bcryptjs on user registration
- `toPublicUser` sanitization (never exposes passwordHash or raw ID numbers)
- Non-admin user 403 Forbidden role guard
- Admin user role access
- Private request access control (403 for non-participants)
- Phone number normalization to E.164 (`+91...`)
- Simulated SMS provider returns status "simulated" (never "delivered")
- Twilio fallback to simulated provider when credentials are missing

---

## 📦 Production Build & Code Splitting

Run the frontend production build:

```bash
cd frontend
npm run build
```

Bundle output is split with `React.lazy` and manual Rollup chunks so **no chunk exceeds 500 kB**:
- `index.js`: ~249 kB
- `leaflet-vendor.js`: ~149 kB
- `socket-vendor.js`: ~41 kB
- `lucide-vendor.js`: ~32 kB
- All route components lazy-loaded on demand.

---

## 🐳 Docker Deployment

Run both backend and frontend via Docker Compose:

```bash
docker compose up --build
```

- Frontend: `http://localhost:8080` (or `http://localhost:5173`)
- Backend: `http://localhost:5000`
- Nginx reverse proxies both `/api/` and `/socket.io/` WebSocket connections.

---

## 📋 Smoke Test Checklist

- [x] **Registration:** New user signs up with Verification ID, email, password, and custom emergency contacts.
- [x] **Login:** Authenticates with bcrypt hash verification; receives JWT.
- [x] **Emergency SOS:** Triggered via 2s press-and-hold; dispatches honest SMS alert (`simulated` badge).
- [x] **Helper Dispatch:** Available helpers receive instant `request:new` notification via Socket.io.
- [x] **Atomic Lock:** First helper accepts; request transitions to `accepted`.
- [x] **Live GPS & Routing:** Helper location streams over `helper:location`; OSRM snaps route to roads.
- [x] **Private In-App Chat:** Real-time messages, typing indicators, and voice notes.
- [x] **WebRTC Calling:** Microphone-to-microphone voice calling with Google STUN signaling.
- [x] **Completion & Safety Confirmation:** Requester marks completed, leaves rating, and confirms "I am Safe".
- [x] **Admin Panel:** Moderates helpers, views audit trail, and verifies masked identity documents.

---

## 🛡️ Security & Privacy Notice

- **Password Security:** All passwords are salt-hashed using `bcryptjs` with 10 rounds. Plaintext passwords are never stored.
- **Identity Protection:** Neither the requester nor the helper can view each other's cellular telephone numbers; all messaging and calls are mediated through in-app WebRTC and Socket.io.
- **Verification ID Masking:** Raw IDs are masked as `XXXX-XXXX-last4` on all public APIs.
- **Zero Third-Party Leaks:** Audio voice notes and coordinates are stored strictly within the private session and access-controlled by JWT authorization.
