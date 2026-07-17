import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, radius, spacing, useAppColors } from './design-tokens';

type IconName = keyof typeof MaterialIcons.glyphMap;

export function AppScreen({ children, scroll = false, contentStyle }: { children: ReactNode; scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  const colors = useAppColors();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, contentStyle]}>{children}</View>
  );
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>{body}</SafeAreaView>;
}

export function AppHeader({
  title,
  onBack,
  backLabel,
  actions,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}) {
  const colors = useAppColors();
  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerSide}>
        {onBack ? <IconButton icon="arrow-back" label={backLabel ?? title} onPress={onBack} /> : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.headerSide, styles.headerActions]}>{actions}</View>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const colors = useAppColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.45 : pressed ? 0.68 : 1 }]}
    >
      <MaterialIcons name={icon} color={colors.text} size={22} />
    </Pressable>
  );
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useAppColors();
  const palette = buttonPalette(colors, variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.76 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} size="small" /> : icon ? <MaterialIcons name={icon} color={palette.text} size={18} /> : null}
      <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function buttonPalette(colors: AppColors, variant: 'primary' | 'secondary' | 'ghost' | 'danger') {
  if (variant === 'danger') return { background: colors.danger, border: colors.danger, text: colors.onDanger };
  if (variant === 'secondary') return { background: colors.surface, border: colors.border, text: colors.text };
  if (variant === 'ghost') return { background: 'transparent', border: 'transparent', text: colors.primary };
  return { background: colors.primary, border: colors.primary, text: colors.onPrimary };
}

export function AppField({ label, error, style, ...inputProps }: TextInputProps & { label?: string; error?: string; style?: StyleProp<TextStyle> }) {
  const colors = useAppColors();
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border, color: colors.text },
          style,
        ]}
      />
      {error ? <Text accessibilityRole="alert" style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function AppCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useAppColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function AppAvatar({ name, size = 42 }: { name: string; size?: number }) {
  const colors = useAppColors();
  const initial = name.trim().slice(0, 1).toLocaleUpperCase() || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.avatarText, { color: colors.primary, fontSize: Math.max(14, size * 0.4) }]}>{initial}</Text>
    </View>
  );
}

export function AppState({
  kind,
  title,
  body,
  action,
}: {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useAppColors();
  if (kind === 'loading') {
    return <View style={styles.state}><ActivityIndicator size="large" color={colors.primary} accessibilityLabel={title} /></View>;
  }
  return (
    <View style={styles.state} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      <MaterialIcons name={kind === 'error' ? 'error-outline' : 'inbox'} size={30} color={kind === 'error' ? colors.danger : colors.textMuted} />
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.stateBody, { color: colors.textMuted }]}>{body}</Text> : null}
      {action ? <AppButton label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function AppListRow({
  title,
  subtitle,
  onPress,
  leading,
  trailing,
}: {
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const colors = useAppColors();
  const content = (
    <View style={[styles.listRow, { borderBottomColor: colors.border }]}>
      {leading ? <View>{leading}</View> : null}
      <View style={styles.listCopy}>
        <Text style={[styles.listTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={[styles.listSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{content}</Pressable> : content;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  header: { minHeight: 56, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  headerSide: { minWidth: 42, alignItems: 'flex-start' },
  headerActions: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  button: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  buttonText: { fontSize: 14, fontWeight: '700' },
  fieldWrap: { gap: spacing.xxs },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: 15 },
  fieldError: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  state: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  stateTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  stateBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  listRow: { minHeight: 68, paddingVertical: spacing.sm, gap: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  listCopy: { flex: 1, gap: 3 },
  listTitle: { fontSize: 15, fontWeight: '700' },
  listSubtitle: { fontSize: 13, lineHeight: 18 },
});
