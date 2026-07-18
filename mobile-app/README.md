# Workplace Mobile App Setup

This app uses Expo SDK 55 and can be installed on Android directly from a local APK and on iOS via EAS cloud builds.

## Prerequisites

- Node.js 20+
- Android Studio with Android SDK installed
- JDK 17 (recommended: Microsoft OpenJDK 17)
- Expo account for iOS cloud builds

## One-time Windows setup

1. Set Java 17 for Gradle:

```powershell
setx JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
setx ORG_GRADLE_JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
```

2. Restart terminal/VS Code after running `setx`.

3. Ensure Android SDK path exists in `android/local.properties`:

```properties
sdk.dir=C:\\Users\\<your-user>\\AppData\\Local\\Android\\Sdk
```

## Install dependencies

From monorepo root:

```bash
npm install
```

## Run in development

From monorepo root:

```bash
npm run dev:android --workspace mobile-app
npm run android:connect --workspace mobile-app
npm run android:debug --workspace mobile-app
```

`android:debug` requires Metro. If Metro is not running or port 8081 is not bridged to the device,
the app shows `Unable to load script`.

## Build installable Android APK

From monorepo root:

```bash
npm run android:apk --workspace mobile-app
```

Local debug APK (requires Metro while running):

```bash
npm run android:apk:debug --workspace mobile-app
```

Generated APK path:

`android/app/build/outputs/apk/debug/app-debug.apk`

Local release APK (standalone, JS bundle embedded):

```bash
npm run android:apk:release --workspace mobile-app
```

Generated APK path:

`android/app/build/outputs/apk/release/app-release.apk`

## Troubleshooting: "Unable to load script"

1. Start Metro for dev client:

```bash
npm run dev:android --workspace mobile-app
```

2. Bridge device port to Metro:

```bash
npm run android:connect --workspace mobile-app
```

3. Reinstall and launch debug build:

```bash
npm run android:debug --workspace mobile-app
```

4. If you need an APK that runs without Metro, build and install release APK instead:

```bash
npm run android:apk:release --workspace mobile-app
```

## Build installable iOS app (from Windows)

You cannot build iOS locally on Windows. Use EAS cloud build:

```bash
npm run ios:ipa --workspace mobile-app
```

If prompted:

- Login: `npx eas-cli login`
- Configure credentials automatically when asked
- Download the generated `.ipa` from the EAS build URL

## Notes

- `ios.bundleIdentifier` and `android.package` are both set to `com.workplace.app` in app config.
- If Android build hangs on toolchain download, verify JDK 17 is installed and environment variables are set.

## Frontend architecture

The presentation layer is rebuilt around `src/presentation` and `src/experience`:

- `presentation/` owns the adaptive page shell, safe-area and keyboard behavior, design-system controls, feedback, offline status, local drafts, and capability-state presentation.
- `experience/` owns the new auth, onboarding, Home, Groups, Chats, Notifications, Menu, profile, search, settings, moderation, and live-room screens.
- `shared/` and `features/*/hooks` remain the source of truth for API contracts, session handling, React Query keys, deep-link invite handling, sockets, localization, and cache/realtime helpers.

The compact shell exposes Home, Groups, Chats, Notifications, and Menu. At regular and expanded widths it automatically switches to a navigation rail and uses split panes where they improve scanning. Android uses resize-mode keyboard handling, safe-area-aware surfaces, and persistent local drafts without queuing unsupported offline mutations.

## Rollout Flags

The following flags control high-risk rollout surfaces:

- `EXPO_PUBLIC_FLAG_AUTH_SESSION_REFRESH` (`true` by default)
- `EXPO_PUBLIC_FLAG_FLASHLIST_RENDERING` (`true` by default)

Example (PowerShell):

```powershell
$env:EXPO_PUBLIC_FLAG_AUTH_SESSION_REFRESH="true"
$env:EXPO_PUBLIC_FLAG_FLASHLIST_RENDERING="true"
```
