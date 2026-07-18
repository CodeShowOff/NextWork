import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useAppColors } from '../shared/ui/design-tokens';

type ToastTone = 'success' | 'error' | 'info';

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onPress: () => void };
  duration?: number;
};

type ToastState = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);

  const dismissToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const finish = () => setToast(null);
    if (reduceMotion) {
      finish();
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -18, duration: 130, useNativeDriver: true }),
    ]).start(finish);
  }, [opacity, reduceMotion, translateY]);

  const showToast = useCallback(
    (input: ToastInput) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const next = {
        ...input,
        id: Date.now(),
        tone: input.tone ?? 'info',
        duration: input.duration ?? 4200,
      } as ToastState;
      setToast(next);
      opacity.setValue(reduceMotion ? 1 : 0);
      translateY.setValue(reduceMotion ? 0 : -18);
      if (!reduceMotion) {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            useNativeDriver: true,
          }),
        ]).start();
      }
      timeoutRef.current = setTimeout(() => dismissToast(), next.duration);
    },
    [dismissToast, opacity, reduceMotion, translateY],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);
  const background =
    toast?.tone === 'error'
      ? colors.danger
      : toast?.tone === 'success'
        ? colors.success
        : colors.text;
  const textColor = toast?.tone === 'info' ? colors.surface : '#FFFFFF';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastLayer,
            { top: insets.top + spacing.sm, opacity, transform: [{ translateY }] },
          ]}
        >
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.toast, { backgroundColor: background }]}
          >
            <Text style={[styles.toastText, { color: textColor }]}>{toast.message}</Text>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                onPress={() => {
                  toast.action?.onPress();
                  dismissToast();
                }}
                style={styles.toastAction}
              >
                <Text
                  style={[
                    styles.toastActionText,
                    { color: toast.tone === 'info' ? colors.accent : '#FFFFFF' },
                  ]}
                >
                  {toast.action.label}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                onPress={dismissToast}
                hitSlop={12}
                style={styles.dismiss}
              >
                <Text style={[styles.dismissText, { color: textColor }]}>×</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 200,
    elevation: 200,
  },
  toast: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 18,
    elevation: 8,
  },
  toastText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  toastAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  toastActionText: { fontSize: 13, fontWeight: '800' },
  dismiss: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 24, lineHeight: 24, fontWeight: '400' },
});
