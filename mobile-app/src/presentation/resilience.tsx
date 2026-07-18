import React, { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { radius, spacing, useAppColors } from '../shared/ui/design-tokens';

type NetworkContextValue = {
  isOnline: boolean;
  isKnown: boolean;
  refresh: () => Promise<NetInfoState>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isKnown: false,
  refresh: () => NetInfo.fetch(),
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setState);
    return unsubscribe;
  }, []);

  const value = useMemo<NetworkContextValue>(
    () => ({
      isOnline: state?.isConnected !== false && state?.isInternetReachable !== false,
      isKnown: state !== null,
      refresh: NetInfo.fetch,
    }),
    [state],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}

export function OfflineBanner() {
  const colors = useAppColors();
  const { isKnown, isOnline, refresh } = useNetwork();
  if (!isKnown || isOnline) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.offline,
        { backgroundColor: colors.surfaceTint, borderColor: colors.borderStrong },
      ]}
    >
      <View style={styles.offlineCopy}>
        <Text style={[styles.offlineTitle, { color: colors.text }]}>You’re offline</Text>
        <Text style={[styles.offlineBody, { color: colors.textMuted }]}>
          Saved content is still available. New updates will need a connection.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check network connection"
        onPress={() => void refresh()}
        style={styles.retry}
      >
        <Text style={{ color: colors.primary, fontWeight: '800' }}>Retry</Text>
      </Pressable>
    </View>
  );
}

/** Keeps local composition text safe without creating an unsafe offline mutation queue. */
export function useStoredDraft(storageKey: string, fallback = '') {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (active && stored !== null) setValue(stored);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      void (value.trim()
        ? AsyncStorage.setItem(storageKey, value)
        : AsyncStorage.removeItem(storageKey));
    }, 280);
    return () => clearTimeout(handle);
  }, [hydrated, storageKey, value]);

  const clear = () => {
    setValue('');
    void AsyncStorage.removeItem(storageKey);
  };

  return { value, setValue, clear, hydrated };
}

const styles = StyleSheet.create({
  offline: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
  },
  offlineCopy: { flex: 1, gap: 2, minWidth: 0 },
  offlineTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  offlineBody: { fontSize: 12, lineHeight: 16 },
  retry: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
