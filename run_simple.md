Listed directory NextWork
Viewed README.md:1-118
Viewed run.md:1-110

Based on the documentation in your `README.md` and `run.md` files, here is the complete step-by-step guide to installing, starting, and running your project on a physical Android phone for testing via USB.

### 1. Install Dependencies

If you haven't recently, install all the dependencies at the root of your project:

```bash
npm install
```

### 2. Start the Backend API

The mobile app requires the backend to be running.

1. Bootstrap the backend database and seed it (you only need to do this once or if the database resets):

```bash
npm run bootstrap --workspace backend-api
```

2. Start the backend server:

```bash
npm run dev --workspace backend-api
```

_You can verify the backend is running by opening `http://localhost:4000/api/v1/health` in your PC's browser._

### 3. Connect and Prepare your Phone

For physical Android devices, the recommended approach is a USB connection using `adb reverse`. This avoids same-Wi-Fi network issues.

1. Connect your phone via USB and make sure **USB debugging** is enabled.
2. Open a new terminal and confirm your device is detected:

```bash
adb devices
```

3. Run the port mappings to allow your phone to talk to your PC's localhost:

```bash
npm run android:connect:all --workspace mobile-app
```

### 4. Build and Run the Mobile App

Build and install the debug app onto your phone:

```bash
npm run android:debug --workspace mobile-app
```

_(Note: You only need to use `android:debug` for the first install or when you make native changes. For normal JS-only updates later, just running `dev:android` is enough)._

### 5. In-App Configuration

Once the app is running on your phone, you'll need to point it to your local backend. In the app's URL fields, use exactly these values:

- API Base URL: `http://localhost:4000/api/v1`
- Realtime Base URL: `http://localhost:4000/realtime`

### Troubleshooting Tip

If the app fails to connect or seems to remember an old URL (because it caches it in secure storage), you can clear the app data and try again:

1. Clear app data:

```bash
adb shell pm clear com.nextwork.app
```

2. Re-run steps 4 and 5.

**For future runs:**
Once the app is successfully installed on your phone, you don't need to rebuild it every time. For everyday development (when you're just changing Javascript/TypeScript code), you will **only** run:

```bash
npm run dev:android --workspace mobile-app
```
