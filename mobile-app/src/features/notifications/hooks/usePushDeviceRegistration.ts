import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { heartbeatNotificationDevice, registerNotificationDevice, unregisterNotificationDevice } from '../../../shared/api/notifications.api';

const HEARTBEAT_MS = 15 * 60 * 1000;

function permissionIsGranted(permission: unknown): boolean {
  // Expo's permission response is structurally different across the native
  // versions supported by this app. Keep the runtime check narrow while
  // accepting both the older `granted` and newer `status` shapes.
  const candidate = permission as { granted?: boolean; status?: string };
  return candidate.granted === true || candidate.status === 'granted';
}

export function usePushDeviceRegistration() {
  const tokenRef = useRef<string | null>(null);
  const platform = Platform.OS as 'ios' | 'android' | 'web';

  useEffect(() => {
    if (!['ios', 'android', 'web'].includes(platform)) return;
    let active = true;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const begin = async () => {
      const existing = await Notifications.getPermissionsAsync();
      const permission = permissionIsGranted(existing) ? existing : await Notifications.requestPermissionsAsync();
      if (!permissionIsGranted(permission) || !active) return;
      const token = (await Notifications.getDevicePushTokenAsync()).data;
      if (!token || !active) return;
      tokenRef.current = token;
      await registerNotificationDevice({ token, platform });
      heartbeat = setInterval(() => { void heartbeatNotificationDevice({ token, platform }).catch(() => undefined); }, HEARTBEAT_MS);
    };
    void begin().catch(() => undefined);
    return () => {
      active = false;
      if (heartbeat) clearInterval(heartbeat);
      const token = tokenRef.current;
      tokenRef.current = null;
      if (token) void unregisterNotificationDevice({ token, platform }).catch(() => undefined);
    };
  }, [platform]);
}
