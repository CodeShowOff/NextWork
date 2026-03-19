# Mobile App Scripts

Source:
- `mobile-app/package.json`

Run these from `mobile-app` unless noted.

## 1. Development Servers and Local Device Setup

### `npm run dev`
Command:
```bash
expo start
```
What it does:
- Starts Expo development server
When to run:
- Daily mobile development

### `npm run dev:android`
Command:
```bash
expo start --dev-client
```
What it does:
- Starts Expo server configured for dev client workflow
When to run:
- Using custom dev client on Android

### `npm run android:connect`
Command:
```bash
adb reverse tcp:8081 tcp:8081
```
What it does:
- Exposes Metro bundler port to Android device/emulator via ADB reverse
When to run:
- Android device cannot reach Metro server

## 2. Native Run Commands

### `npm run android`
Command:
```bash
expo run:android
```
What it does:
- Builds/runs Android app locally via Expo native workflow
When to run:
- Local Android testing with native modules

### `npm run android:debug`
Command:
```bash
expo run:android --variant debug
```
What it does:
- Runs Android debug variant
When to run:
- Debugging and local testing

### `npm run android:release`
Command:
```bash
expo run:android --variant release
```
What it does:
- Runs Android release variant locally
When to run:
- Release-like behavior checks

### `npm run ios`
Command:
```bash
expo run:ios
```
What it does:
- Runs iOS build in local native workflow
When to run:
- Local iOS testing (on macOS-supported environments)

## 3. Build Artifact Commands

### `npm run android:apk`
Command:
```bash
npx eas-cli build --platform android --profile preview
```
What it does:
- Starts Android APK build using EAS preview profile
When to run:
- Internal QA distribution

### `npm run android:apk:debug`
Command:
```bash
cd android && gradlew.bat assembleDebug
```
What it does:
- Produces local debug APK via Gradle
When to run:
- Local debug APK generation without EAS

### `npm run android:apk:release`
Command:
```bash
cd android && gradlew.bat assembleRelease
```
What it does:
- Produces local release APK via Gradle
When to run:
- Local release candidate APK checks

### `npm run ios:ipa`
Command:
```bash
npx eas-cli build --platform ios --profile preview
```
What it does:
- Starts iOS build artifact generation through EAS
When to run:
- Internal iOS distribution/testing pipeline

## 4. Quality Checks

### `npm run lint`
Command:
```bash
eslint "src/**/*.{ts,tsx}"
```
What it does:
- Lints mobile source files
When to run:
- Before commit

### `npm run typecheck`
Command:
```bash
tsc --noEmit
```
What it does:
- Type checks mobile app TS/TSX
When to run:
- After refactors
- Before PR

### `npm run test`
Command:
```bash
jest --config jest.config.cjs
```
What it does:
- Runs mobile unit/integration test suite configured in Jest
When to run:
- Before merge/release

## 5. Recommended Sequences

### Daily development
```bash
npm run dev
```

### Android local debugging
```bash
npm run android:connect
npm run dev:android
npm run android
```

### Pre-PR mobile check
```bash
npm run lint
npm run typecheck
npm run test
```

### Internal Android build flow
```bash
npm run lint
npm run typecheck
npm run test
npm run android:apk
```

### Internal iOS build flow
```bash
npm run lint
npm run typecheck
npm run test
npm run ios:ipa
```
