# Help Radius – System Audit & Feature Readiness Report

**Generated Date:** November 16, 2026  
**Repository:** [github.com/sanhithaps/helpradius](https://github.com/sanhithaps/helpradius)  
**Target Audience:** Software Architect / Claude Code / AI Engineering Assistant  
**Codebase Stack:** React 18, Vite, Tailwind CSS, Leaflet OpenStreetMap, Node.js, Express REST API, JSON File Database Persistence.

---

## 1. Executive Summary

Help Radius is a hyper-local community emergency response and mutual-aid assistance platform. It connects users requiring urgent assistance (Emergency SOS, General Physical Assistance, or Scheduled Aid) with vetted nearby community volunteers within an expanding radius (2 km → 5 km → 10 km → 20 km).

This audit report provides an objective evaluation of every subsystem, detailing **what is production-ready**, **what is working as an interactive prototype**, and **what is mocked or needs engineering work** for future iterations.

---

## 2. Feature Status Matrix

| Subsystem | Feature | Status | Implementation Mode |
|---|---|---|---|
| **Auth & Identity** | User Registration with Verification ID | ✅ **Working** | Full-stack, mandatory ID, role choice, saved to `backend/data/users.json` |
| **Auth & Identity** | Persistent Database Login | ✅ **Working** | Full-stack, strictly verifies email/phone & password against database |
| **Auth & Identity** | Custom Emergency Contacts (Up to 6) | ✅ **Working** | Full-stack, user-configured names & numbers, enforced max 6 limit |
| **Auth & Identity** | Demo Switcher / Mock Accounts | ❌ **Removed** | "Priya Sharma", "Arjun Verma", and dummy numbers removed |
| **Auth & Identity** | SMS OTP Verification | 🟡 **Prototype** | Simulated OTP (`123456`) logged to console, no real telecom gateway |
| **Auth & Identity** | Password Hashing (Security) | ❌ **Not Done** | Passwords stored as plain strings in JSON (needs `bcryptjs`) |
| **Requests & Dispatch** | Emergency SOS Trigger (1-Click) | ✅ **Working** | Full-stack, 100% free pricing, category & GPS capture |
| **Requests & Dispatch** | General Help & Scheduled Help | ✅ **Working** | Full-stack, category selection, duration, scheduled meeting point |
| **Requests & Dispatch** | Atomic Helper Acceptance Lock | ✅ **Working** | Server concurrency lock prevents race condition double-acceptance |
| **Requests & Dispatch** | Request Cancellation & Completion | ✅ **Working** | Full lifecycle transitions (`searching` → `accepted` → `completed`/`cancelled`) |
| **Requests & Dispatch** | Helper Reviews & Safety Confirmation | ✅ **Working** | 1-5 star ratings, comments, and "I am Safe" confirmation badge |
| **Matching & Radius** | Dynamic Radius Expansion Engine | ✅ **Working** | Background worker expands 2km → 5km → 10km → 20km every 3s |
| **Matching & Radius** | Duplicate Suppression | ✅ **Working** | `notifiedHelperIndex` ensures helpers aren't alerted repeatedly |
| **Matching & Radius** | Personal Safety Helper Gating | ✅ **Working** | Physical danger SOS restricted to `safetyEligible` verified volunteers |
| **Matching & Radius** | 3-Tier Transparent Pricing Engine | ✅ **Working** | Expansion fee + travel comp (first 2km free) + optional tip |
| **Live Tracking** | Leaflet OpenStreetMap Visualizer | ✅ **Working** | Custom SVG pins, connecting polyline, bounds fitting |
| **Live Tracking** | Haversine Distance & ETA Calculation | ✅ **Working** | Accurate spherical trigonometry + urban traffic speed estimation |
| **Live Tracking** | Real-Time Location Updates | 🟡 **Prototype** | Polling-based (3s interval); no real WebSockets/Socket.io yet |
| **Live Tracking** | Turn-by-Turn Road Routing | ❌ **Not Implemented** | Uses straight-line distance; no OSRM or Google Directions API |
| **Communication** | In-App Private Text Chat | ✅ **Working** | Full-stack, session-scoped, auto-locks on request completion |
| **Communication** | MediaRecorder Audio Voice Notes | ✅ **Working** | Browser audio recording, data URI storage, in-chat audio playback |
| **Communication** | Zero Phone Number Exposure | ✅ **Working** | Neither party's cellular number is exposed in the frontend |
| **Communication** | In-App Voice Calling | 🟡 **Prototype** | AudioContext synthetic ringtone & timer; WebRTC audio stream simulated |
| **Alerts & External** | Emergency Contact Notification | ✅ **Working** | Dispatches simultaneous in-app tracking alerts with Google Maps link |
| **Alerts & External** | Cellular SMS Dispatch | 🟡 **Prototype** | `smsService.js` simulated logger; Twilio/Fast2SMS carrier not connected |
| **Administration** | Admin Management Panel (`/admin`) | ✅ **Working** | Live metrics, helper approvals, safety certifications, user ban |
| **Administration** | System Audit Trail | ✅ **Working** | Records in-memory/persisted audit entries for all critical events |
| **Multi-Device** | Friend-to-Friend Testing over LAN | ✅ **Working** | Host listening enabled (`--host`), CORS enabled for local network IPs |

---

## 3. Subsystem Breakdown: Deep Dive

### 3.1. Authentication, Registration & Persistence
- **Current State:** Fully implemented.
  - Form collects Full Name, Email, Mobile, Password, Verification ID Type & Number (Aadhaar, Student ID, Voter ID, Driving License, Passport), Role (`user` vs `helper`), and custom Emergency Contacts.
  - Stored persistently in `backend/data/users.json`. Server restarts reload all users without loss.
  - Login strictly queries the database. Unregistered email returns HTTP `404`; incorrect password returns HTTP `401`.
  - All demo mock switchers ("Priya Sharma" / "Arjun Verma") have been removed from the Navbar and AuthContext.
- **What is NOT Working / Missing:**
  1. **Password Hashing:** Passwords are saved in plaintext inside `users.json`. In production, this must use `bcrypt.hash(password, 10)` before saving.
  2. **Real SMS OTP:** Mobile verification returns a simulated OTP `123456`. Real SMS gateway integration (e.g. Twilio, AWS SNS, or Indian DLT provider) is stubbed.

### 3.2. Request Lifecycle & Concurrency
- **Current State:** Fully functional REST implementation.
  - Creation endpoints: `POST /api/requests` supports `emergency`, `general`, and `scheduled`.
  - Persistence: Saved directly to `backend/data/requests.json`.
  - Concurrency Lock: When a helper accepts (`POST /api/requests/:id/accept`), the backend checks if `request.acceptedHelperId` is null. If already accepted by someone else, subsequent attempts receive HTTP `409 Conflict`, preventing double-booking.
  - Personal Safety Filter: Requests flagged with `category: 'personal_safety'` or `physical_danger` require `helper.safetyEligible === true`. General volunteers cannot accept these requests.
  - Request Rating & Safe Confirmation: Requester rates assistance (1–5 stars) and checks "I am safe", updating the helper's average rating.

### 3.3. Radius Expansion Engine (`radiusEngine.js`)
- **Current State:** Working background service.
  - Runs a 3-second timer checking all `searching` requests.
  - Automatically advances search radius:
    - Step 0: 2 km
    - Step 1: 5 km
    - Step 2: 10 km
    - Step 3: 20 km
  - Employs duplicate suppression (`notifiedHelperIndex`) so helpers in inner rings do not receive repeated pings on subsequent expansion sweeps.
- **What is NOT Working / Missing:**
  - Notifications are stored in-memory in `notificationService.js` and polled by the client. Real Web Push API / Service Workers (FCM) are not configured.

### 3.4. Live Tracking & Maps (`TrackingMap.jsx`)
- **Current State:** OpenStreetMap integration via Leaflet.
  - Displays requester's location pin (red) and helper's pin (green) with a dotted polyline connecting them.
  - Floating HUD displays computed Haversine distance and estimated arrival time (ETA) based on average 25 km/h urban transit.
- **What is NOT Working / Missing:**
  1. **Road-snapped Routing:** The route line is a direct coordinate-to-coordinate line. It does not snap to actual road networks (requires OSRM or Google Directions API).
  2. **WebSocket Real-time Updates:** Position changes rely on HTTP polling every 3 seconds rather than a bi-directional WebSocket connection.
  3. **LAN Geolocation on Chrome:** Browsers block HTML5 Geolocation (`navigator.geolocation`) on unencrypted HTTP connections (except `localhost`). When testing between two laptops over LAN (`http://10.x.x.x`), users must either enable Chrome flag `#unsafely-treat-insecure-origin-as-secure` or rely on the coordinate picker.

### 3.5. Private In-App Communication
- **Current State:**
  - **Text Chat:** Functional private room created automatically upon request acceptance (`/chat/:requestId`).
  - **Voice Notes:** Uses HTML5 `MediaRecorder` API. Records `.webm`/`.wav` audio directly in the browser, converts to Base64, transmits to backend, and renders an audio player inside the message bubble.
  - **Privacy:** Requester and helper never see each other's phone numbers. Communication is strictly sandboxed inside the active request.
  - **Chat Lock:** Chat is automatically closed and disabled once the request status changes to `completed` or `cancelled`.
- **What is NOT Working / Missing:**
  - **Voice Calling:** Voice calling modal (`VoiceCallModal.jsx`) simulates an in-app call using Web Audio API (synthesizes audio beeps and a duration timer). The WebRTC SDP offer/answer signaling and peer-to-peer audio streams (STUN/TURN) are prototype stubs and not connected to a live WebRTC media pipeline.

### 3.6. Emergency Contact Alerts & SMS Gateway
- **Current State:**
  - Emergency SOS automatically generates alert records for all saved emergency contacts of the requester.
  - Alerts generate a direct Google Maps coordinate link: `https://www.google.com/maps?q=lat,lng`.
- **What is NOT Working / Missing:**
  - `smsService.js` contains the simulated fallback. It logs the formatted SMS to the backend terminal and marks it as `delivered` with a badge. Real cellular SMS requires connecting Twilio credentials or an Indian DLT-compliant SMS gateway in `.env`.

### 3.7. Admin Panel (`/admin`)
- **Current State:** Fully functional.
  - Admin credentials: Configured via `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` (hashed with bcrypt).
  - Capabilities:
    - View all registered helpers and their submitted ID numbers.
    - Approve or reject pending helper applications.
    - Grant or revoke **Personal Safety Certification** (`safetyEligible`).
    - Suspend / Ban problematic users.
    - Inspect system audit logs with timestamps and actor IDs.

---

## 4. Test Suite Verification

The project includes an automated Node.js test runner suite (`backend/test/api.test.js`).
All 5 test suites pass cleanly:

```bash
> node --test test/*.test.js

✔ Haversine Distance calculation accuracy (2.284ms)
✔ ETA estimation adheres to urban transit speed (0.367ms)
✔ Pricing rule: Emergency SOS is 100% free and voluntary reward is optional (0.5646ms)
✔ Pricing rule: General Help separates 3 transparent tiers and first 2 km travel is free (0.3663ms)
✔ Emergency Contacts: Enforces maximum 6 contacts rule (0.3729ms)
ℹ tests 5 | pass 5 | fail 0 | skipped 0
```

Frontend production build (`npm run build`) builds cleanly with zero syntax or bundling errors:
```
dist/index.html                   1.42 kB
dist/assets/index-B_ij_ZGM.css   42.91 kB
dist/assets/index-7Q9QP1tl.js   547.75 kB
✓ built in 1m 3s
```

---

## 5. Architectural Recommendations for Claude / Future Sprints

If you are handing this project over to Claude for further development, here is the prioritized roadmap of what to implement next:

### Priority 1: Security Hardening (Production Fundamentals)
1. **Password Hashing:**
   - Install `bcryptjs`.
   - Update `authController.js` to hash passwords on registration: `await bcrypt.hash(password, 10)`.
   - Compare hashes on login: `await bcrypt.compare(password, user.password)`.
2. **Environment Variable Configuration:**
   - Move `JWT_SECRET` and port bindings strictly into `.env`.
   - Prevent default admin credentials in production environments.

### Priority 2: Real-time Communication (Replace Polling)
1. **Integrate Socket.io:**
   - Replace 3-second HTTP polling in `ChatPage.jsx`, `HelperInboxPage.jsx`, and `ActiveRequestPage.jsx` with WebSocket event emitters (`request:created`, `request:accepted`, `helper:location_updated`, `chat:new_message`).
2. **Live Helper GPS Streaming:**
   - Add a background `navigator.geolocation.watchPosition` hook on the helper's client to emit real-time location updates to the tracking map.

### Priority 3: External Service Integrations
1. **Real SMS Gateway:**
   - Connect `smsService.js` to Twilio API or Fast2SMS / MSG91 API to send real SMS text messages to emergency contacts with the live Google Maps URL.
2. **Turn-by-Turn Road Routing:**
   - Replace straight-line Leaflet polyline with Open Source Routing Machine (OSRM) API (`https://router.project-osrm.org/route/v1/driving/...`) to render realistic driving/walking paths.
3. **WebRTC Voice Calling:**
   - Complete WebRTC peer connection in `callController.js` using free Google STUN servers (`stun:stun.l.google.com:19302`) to enable real microphone-to-microphone in-app audio calls.

### Priority 4: Production Database Migration
1. **Migrate from JSON Files to MongoDB or PostgreSQL:**
   - Currently, `backend/data/*.json` persists state cleanly for local testing and demos.
   - For multi-instance scaling or production concurrency, transition `DataStore` to MongoDB (Mongoose) or PostgreSQL (Prisma/Sequelize).

---

## 6. How to Run the Project Right Now

### Start Backend (Port 5000):
```bash
cd backend
node src/server.js
# Or: npm start
```

### Start Frontend (Port 5173):
```bash
cd frontend
npm run dev -- --host --port 5173
```

### Testing Accounts:
- **Admin**: Configured in `backend/.env` (`ADMIN_EMAIL` and `ADMIN_PASSWORD`).
- **New Registration**: Open [http://localhost:5173/register](http://localhost:5173/register) to create any new Requester or Volunteer account.
