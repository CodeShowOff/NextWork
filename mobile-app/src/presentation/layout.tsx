import React, { ReactNode, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useAppColors } from '../shared/ui/design-tokens';
import { resolveContentBottomInset, resolveLayoutSize } from './layout.logic';

export type { LayoutSize } from './layout.logic';
export { resolveContentBottomInset, resolveLayoutSize } from './layout.logic';

export function useAdaptiveLayout() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const size = resolveLayoutSize(width, height);
  return {
    width,
    height,
    shortestSide,
    size,
    isCompact: size === 'compact',
    isRegular: size === 'regular',
    isExpanded: size === 'expanded',
    isLandscape: width > height,
    contentMaxWidth: size === 'compact' ? undefined : size === 'regular' ? 760 : 920,
  };
}

export function useContentInset(extra = 0) {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => ({ paddingBottom: resolveContentBottomInset(insets.bottom, extra) }),
    [extra, insets.bottom],
  );
}

type PageProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  keyboardAware?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
};

/** A screen shell with correct safe-area, keyboard, and wide-screen behavior. */
export function Page({
  children,
  scroll = false,
  style,
  contentStyle,
  testID,
  keyboardAware = true,
  edges = ['left', 'right', 'bottom'],
}: PageProps) {
  const colors = useAppColors();
  const layout = useAdaptiveLayout();
  const insets = useSafeAreaInsets();
  const bodyStyle = [
    styles.content,
    layout.contentMaxWidth
      ? { width: '100%' as const, maxWidth: layout.contentMaxWidth, alignSelf: 'center' as const }
      : null,
    scroll
      ? {
          paddingBottom: Math.max(
            spacing.xxl,
            resolveContentBottomInset(insets.bottom, spacing.xs),
          ),
        }
      : null,
    contentStyle,
  ];

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, bodyStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, bodyStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.fill, { backgroundColor: colors.background }, style]}
    >
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          keyboardVerticalOffset={0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function CenteredContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const layout = useAdaptiveLayout();
  return (
    <View
      style={[
        styles.centered,
        layout.isCompact ? null : { maxWidth: 520, alignSelf: 'center', width: '100%' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function TwoPane({
  leading,
  children,
  leadingWidth = 310,
}: {
  leading: ReactNode;
  children: ReactNode;
  leadingWidth?: number;
}) {
  const layout = useAdaptiveLayout();
  if (layout.isCompact) {
    return <>{children}</>;
  }

  return (
    <View style={styles.twoPane}>
      <View style={[styles.twoPaneLeading, { width: leadingWidth }]}>{leading}</View>
      <View style={styles.twoPaneContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  content: { flexGrow: 1, minWidth: 0 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  centered: { width: '100%', minWidth: 0 },
  twoPane: { flex: 1, minWidth: 0, flexDirection: 'row' },
  twoPaneLeading: { borderRightWidth: StyleSheet.hairlineWidth, minWidth: 0 },
  twoPaneContent: { flex: 1, minWidth: 0 },
});
