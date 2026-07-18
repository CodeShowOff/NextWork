# Run NextWork Mobile App on a Real Phone (Without Docker)

This guide is for first-time setup on Windows and running the app on a real phone.

It covers:
- What to install (basic prerequisites)
- What to configure first
- Exact command order
- What each command does
- When to run each command
- How to connect your phone to your local backend

This guide does NOT use Docker.

---

## 0. Goal and Architecture (Simple View)

Your phone app needs these local services running on your PC:
- Backend API (NestJS) on port 4000
- PostgreSQL on port 5432
- Redis on port 6379

Phone and PC must be on the same Wi-Fi.

Important:
- localhost on your phone means the phone itself, not your PC.
- So on phone, you must use your PC LAN IP (example: 192.168.x.x) in app URL fields.

---

## 1. One-Time Installs (If Not Already Installed)

You said dependencies are already installed. If everything below is already done, skip to section 2.

### 1.1 Install Node.js

Install Node.js LTS (20+ recommended).

Why:
- Needed for npm, backend, and Expo scripts.

Check:
- node -v
- npm -v

### 1.2 Install PostgreSQL (local)

Install PostgreSQL server locally.

Why:
- Backend stores app data in Postgres.

Check:
- psql --version

If psql is not in PATH, PostgreSQL can still work. You can verify by checking Services app:
- Service name usually looks like postgresql-x64-xx
- Status should be Running

### 1.3 Install Redis (local)

Install Redis on Windows (service or local install).

Why:
- Backend uses Redis for cache/realtime/background behavior.

Check:
- redis-cli ping

Expected result:
- PONG

### 1.4 Install Android Studio + Android SDK

Install Android Studio and Android SDK.

Why:
- Needed for building/running Android app from React Native/Expo native workflow.

### 1.5 Install Java JDK 17

Install JDK 17.

Why:
- Android Gradle build requires Java 17 in this project.

Set env vars in PowerShell (example path):
- setx JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
- setx ORG_GRADLE_JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"

After this, restart VS Code and terminal.

---

## 2. Open Project and Install JS Dependencies

Run from nextwork root:

1) Command:
- npm install

What it does:
- Installs root + nextwork dependencies (mobile-app, backend-api, packages).

When to run:
- First setup
- After pulling dependency changes

---

## 3. Create Backend Environment File (Required)

Create file:
- backend-api/.env

Use this starter content (replace user/password):

NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nextwork
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-32-plus-char-access-secret
JWT_REFRESH_SECRET=replace-with-32-plus-char-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

How to generate long secrets quickly (PowerShell):
- [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')

Why this file is required:
- Backend validates these env variables at startup.

---

## 4. Prepare Database and Start Backend

Open terminal A.

Go to backend:
- cd backend-api

Run these in exact order:

1) Command:
- npm run bootstrap

What it does:
- Runs prisma migrate deploy (applies migrations)
- Runs prisma seed (inserts starter data)

When to run:
- First setup
- Any time new migrations are pulled

2) Command:
- npm run dev

What it does:
- Starts backend server in watch mode on port 4000.

When to run:
- Every time you want to use the mobile app against local backend.

Keep terminal A running.

---

## 5. Verify Backend Health Before Mobile

Still with backend running, check health endpoint from PC browser:
- http://localhost:4000/api/v1/health

Expected:
- Status should report healthy API and connected services.

If not healthy:
- Fix Postgres/Redis/env first, then continue.

---

## 6. Find Your PC LAN IP (Used by Phone)

Open terminal B at nextwork root.

Command:
- Get-NetIPAddress -AddressFamily IPv4 |
Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object IPAddress, InterfaceAlias

Pick your active Wi-Fi adapter IPv4, example:
- 192.168.13.115

You will use:
- API URL: http://YOUR_PC_IP:4000/api/v1
- Realtime URL: http://YOUR_PC_IP:4000/realtime

---

## 7. Build and Install Android App on Real Phone

This is the cleanest first-time real phone path.

### 7.1 Enable Phone Developer Options

On Android phone:
- Enable Developer Options
- Enable USB debugging

### 7.2 Connect Phone via USB

Command:
- adb devices

What it does:
- Confirms ADB can see your phone.

Expected:
- Your device serial appears with device status.

### 7.3 Build and install debug app

From nextwork root, run:

1) Command:
- npm run dev:android --workspace mobile-app

What it does:
- Starts Metro bundler for dev client workflow.

When to run:
- Every time using debug build

2) Command:
- npm run android:connect --workspace mobile-app

What it does:
- Runs adb reverse for port 8081 so phone can load JS bundle from your PC.

When to run:
- Usually after USB connected
- Run again if cable reconnects or app cannot load bundle

3) Command:
- npm run android:debug --workspace mobile-app

What it does:
- Builds Android debug variant and installs it on connected device.

When to run:
- First install on phone for development
- Rebuild after native changes

Keep terminal B running with Metro.

---

## 8. Configure API/Realtime URLs Inside the App

When app opens on phone (Auth screen), set:
- API URL input: http://YOUR_PC_IP:4000/api/v1
- Realtime URL input: http://YOUR_PC_IP:4000/realtime

Example with IP 192.168.13.115:
- http://192.168.13.115:4000/api/v1
- http://192.168.13.115:4000/realtime

Then continue with login/signup.

Why:
- Default Android host 10.0.2.2 is for emulator, not real physical phone.

---


## 9. Quick Connectivity Check from Phone

On phone browser (same Wi-Fi), open:
- http://YOUR_PC_IP:4000/api/v1/health

If this fails, app cannot connect either.

Fix order:
1. Confirm backend still running in terminal A.
2. Confirm phone and PC are on same Wi-Fi.
3. Allow inbound TCP 4000 in Windows Firewall.
4. Re-test phone browser URL.

Optional firewall command (PowerShell as Admin):
- netsh advfirewall firewall add rule name="NextWork API 4000" dir=in action=allow protocol=TCP localport=4000

---

## 10. Daily Run Sequence (After First Setup)

Use 2 terminals.

Terminal A (backend):
1. cd backend-api
2. npm run bootstrap
3. npm run dev

Terminal B (mobile):
1. npm run dev:android --workspace mobile-app
2. npm run android:connect --workspace mobile-app
3. npm run android:debug --workspace mobile-app

Then open app on phone and keep URLs set to your PC LAN IP.

---

## 11. Optional: APK That Runs Without Metro

If you want an installable APK less dependent on Metro:

From nextwork root:
- npm run android:apk:release --workspace mobile-app

APK output:
- mobile-app/android/app/build/outputs/apk/release/app-release.apk

Notes:
- Release build signing/install details may vary by device policy.
- For normal development, debug flow in section 7 is faster.

---

## 12. Common Errors and Exact Fixes

### Error: Unable to load script

Cause:
- Metro not running or adb reverse not active.

Fix sequence:
1. npm run dev:android --workspace mobile-app
2. npm run android:connect --workspace mobile-app
3. Reopen app on phone

### Error: Backend starts then crashes with env validation

Cause:
- Missing/invalid values in backend-api/.env.

Fix:
- Recheck required keys in section 3.

### Error: Database authentication failed (P1000)

Cause:
- Wrong DATABASE_URL credentials.

Fix:
- Update DATABASE_URL user/password in backend-api/.env.
- Re-run: npm run bootstrap

### Error: Redis connection refused

Cause:
- Redis not running.

Fix:
- Start Redis service.
- Verify with: redis-cli ping

### Error: Phone cannot hit http://YOUR_PC_IP:4000/api/v1/health

Cause:
- Network/firewall/backend issue.

Fix:
- Same Wi-Fi, backend running, firewall inbound rule for 4000.

---

## 13. iPhone Note (If You Also Test on iOS)

From Windows, you cannot build iOS locally.
Use EAS cloud build:
- npm run ios:ipa --workspace mobile-app

For your current goal (run on your own phone now), Android real device on Windows is the fastest path.

---

## 14. One-Screen Command Checklist

First-time setup:
1. npm install
2. cd backend-api
3. npm run bootstrap
4. npm run dev
5. Open new terminal at root
6. npm run dev:android --workspace mobile-app
7. npm run android:connect --workspace mobile-app
8. npm run android:debug --workspace mobile-app
9. Enter API/Realtime URLs in app with your PC LAN IP

Daily run:
1. cd backend-api
2. npm run bootstrap
3. npm run dev
4. npm run dev:android --workspace mobile-app
5. npm run android:connect --workspace mobile-app
6. npm run android:debug --workspace mobile-app

You are ready when:
- Backend health works on PC and phone browser
- App opens on phone and login/signup can call backend




---
---



Start backend dependencies and API
Run from repo root:
npm run db:up --workspace backend-api
npm run prisma:sync --workspace backend-api
npm run prisma:seed --workspace backend-api
npm run dev --workspace backend-api
Keep this terminal running. Your backend should be on port 4000.

Run app on Android phone (first-time dev run)
On phone:
Enable Developer options
Enable USB debugging
Connect phone by USB and approve RSA prompt.

Verify device:
adb devices

Start Metro in terminal 2:
npm run dev:android --workspace mobile-app

Bridge Metro port:
npm run android:connect --workspace mobile-app

Also bridge API port for local backend:
adb reverse tcp:4000 tcp:4000

Install and run debug app:
npm run android:debug --workspace mobile-app

Important note for physical phone API connection
This code defaults Android API host to 10.0.2.2, which is emulator-oriented, not physical phone.
If login/API calls fail on real phone, use one of these:

Preferred: set Android host to localhost in runtime.ts:4, keep adb reverse for 4000.

Alternative: set it to your PC LAN IP (example 192.168.1.x) and keep phone + PC on same Wi-Fi.

Then restart Metro and rerun Android debug.

Build installable APK (without needing Metro)
From repo root:
Local release APK:
npm run android:apk:release --workspace mobile-app
Install on connected phone:
adb install -r mobile-app\android\app\build\outputs\apk\release\app-release.apk
If local release signing/build gives trouble, use EAS cloud APK:
npm run android:apk --workspace mobile-app
This uses preview profile configured for internal APK distribution.

---


Exact deployment steps (backend)

Prepare env
Copy .env.production.example to backend-api/.env.production
Fill real values for DB, Redis, JWT secrets, and public URLs.
Install dependencies
npm ci
Quality and security gate
npm run release:gates
npm run test:security
npm run test:e2e:verify
Build backend
npm run build --workspace backend-api
Apply DB schema (production DB URL must be set)
npm run prisma:sync --workspace backend-api
Start backend
npm run start --workspace backend-api
Smoke test endpoints
GET /api/v1/health/live
GET /api/v1/health/ready
GET /api/v1/ops/metrics
GET /api/v1/ops/prometheus
GET /api/docs
Exact deployment steps (mobile app)

Prepare mobile env
Copy .env.example to mobile-app/.env
Set flags for release channel.
Android internal build
npm ci
npm run android:apk --workspace mobile-app
iOS build from Windows (cloud build)
npm run ios:ipa --workspace mobile-app
Device validation before rollout
Login/logout
Token refresh behavior
Feed/messages/notifications smoke flows
Connectivity to production API