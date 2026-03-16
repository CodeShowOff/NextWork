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
npm run dev --workspace mobile-app
npm run android --workspace mobile-app
```

## Build installable Android APK

From monorepo root:

```bash
npm run android:apk --workspace mobile-app
```

Or local Gradle debug APK:

```bash
cd mobile-app/android
./gradlew assembleDebug
```

Generated APK path:

`android/app/build/outputs/apk/debug/app-debug.apk`

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
