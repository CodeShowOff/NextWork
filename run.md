Yes, both are redundant when run back-to-back.

What to run
1. Use only npm run android:debug --workspace mobile-app when you need build/install (first run, native change, clean reinstall).
2. Use only npm run dev:android --workspace mobile-app for normal JS-only reruns after app is already installed.
3. Do not keep both running at once, because the second command starts Metro again and causes the 8081→8082 port switch.

About this line
- env: export EXPO_PUBLIC_API_BASE_URL ... EXPO_PUBLIC_RELEASE_CHANNEL EXPO_PUBLIC_RELEASE_VERSION
- This is normal. Expo is just loading values from mobile-app/.env.

About this warning
- The /android project does not contain any URI schemes...
- For your USB dev-client flow, this is usually non-blocking and safe to ignore.
- It only affects deep-link based launching behavior from Expo CLI.
- Your app still builds/installs, so this is not the auth/network failure cause.

Why you saw it twice
- Because each command independently starts Expo/Metro and prints the same startup diagnostics.

Best clean flow now
1. Stop all Metro terminals.
2. Run only npm run android:debug --workspace mobile-app.
3. Test login.
4. For next runs without native changes, switch to only npm run dev:android --workspace mobile-app.Clarified that running `dev:android` and `android:debug` sequentially is redundant, explained the correct one-command workflow for each scenario, and confirmed both the Expo env export line and URI-scheme warning are informational and not the root cause of your auth issue.
---



You are right to call this out. There was a real trap in your app config, and I fixed it.

I changed Android fallback host logic in runtime.ts so:
- Physical Android device defaults to localhost
- Android emulator still defaults to 10.0.2.2

This matters because your previous fallback could push the app to emulator host even on a real phone when host auto-detection fails.

Do this exact recovery flow now
1. Stop Metro and backend terminals.
2. Start backend again and verify:
   - npm run dev --workspace backend-api
   - open http://localhost:4000/api/v1/health on PC browser
3. Connect phone USB and verify:
   - adb devices
4. Recreate reverse rules:
   - adb reverse --remove-all
   - adb reverse tcp:8081 tcp:8081
   - adb reverse tcp:4000 tcp:4000
   - adb reverse --list
5. Clear app stored session/URLs (important):
   - adb shell pm clear com.nextwork.app
6. Start Metro:
   - npm run dev:android --workspace mobile-app
7. Reinstall/run app:
   - npm run android:debug --workspace mobile-app
8. In app URL fields use exactly:
   - http://localhost:4000/api/v1
   - http://localhost:4000/realtime

Why retries kept failing
- The app persists apiBaseUrl and realtimeBaseUrl in secure storage, so one bad value can keep getting reused across attempts.
- Clearing app data removes stale persisted values and forces clean runtime defaults.

If it still fails, send me output from these 3 commands and I will pinpoint the next blocker fast:
1. adb reverse --list
2. adb devices
3. First 20 lines of backend startup log after npm run dev --workspace backend-api

Made changes.

---




Yes. The best alternative for your case is USB-only testing with ADB reverse, so you do not need same Wi-Fi, and you can avoid the Android Studio app UI.

Most stable option (recommended)
1. Keep backend running on PC at port 4000.
2. Connect phone by USB and confirm:
adb devices
3. Start Metro:
npm run dev:android --workspace mobile-app
4. Run all reverse mappings in one step:
npm run android:connect:all --workspace mobile-app
5. Build/install debug app:
npm run android:debug --workspace mobile-app
6. In app URL fields, use:
http://localhost:4000/api/v1
http://localhost:4000/realtime

Why this works:
- adb reverse maps phone localhost back to your PC ports.
- No same-Wi-Fi dependency.

Important note:
- Your runtime fallback for Android is emulator-style 10.0.2.2, so for real phone + USB reverse, localhost is safer. This behavior is in runtime.ts.

If you also want to avoid Android SDK/Studio locally
1. Build APK in cloud:
npm run android:apk --workspace mobile-app
2. Install APK on phone.
3. For backend access:
- Either keep USB and run adb reverse tcp:4000 tcp:4000
- Or expose backend with a tunnel (Cloudflare Tunnel or ngrok), then set that HTTPS URL in app.

If you want, I can give you one exact copy-paste flow for your preferred mode:
1. USB-only local backend (most reliable)
2. Cloud APK + USB backend
3. Cloud APK + public tunnel backend