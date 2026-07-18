import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography, useAppColors } from '../shared/ui/design-tokens';
import { useAdaptiveLayout } from './layout';

export type IconName = keyof typeof MaterialIcons.glyphMap;
export type Capability = 'live' | 'preview' | 'unavailable';

function triggerHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  void Haptics.impactAsync(style).catch(() => undefined);
}

export function AppHeader({
  title,
  subtitle,
  leading,
  trailing,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.header,
        compact ? styles.headerCompact : null,
        { borderBottomColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.headerSide}>{leading}</View>
      <View style={styles.headerCopy}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.headerTitle, { color: colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerActions]}>{trailing}</View>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  badge,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: number | boolean;
  testID?: string;
}) {
  const colors = useAppColors();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
          opacity: disabled ? 0.42 : 1,
        },
      ]}
    >
      <MaterialIcons name={icon} size={22} color={colors.text} />
      {badge ? (
        <View style={[styles.iconBadge, { backgroundColor: colors.danger }]}>
          <Text style={styles.iconBadgeText}>
            {typeof badge === 'number' && badge > 9 ? '9+' : ''}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useAppColors();
  const palette = getButtonPalette(colors, variant);
  const blocked = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerHaptic();
        onPress();
      }}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        fullWidth ? styles.buttonWide : null,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: blocked ? 0.46 : pressed ? 0.76 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : icon ? (
        <MaterialIcons name={icon} size={18} color={palette.text} />
      ) : null}
      <Text numberOfLines={1} style={[styles.buttonText, { color: palette.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getButtonPalette(colors: ReturnType<typeof useAppColors>, variant: ButtonVariant) {
  if (variant === 'secondary')
    return { background: colors.surface, border: colors.borderStrong, text: colors.text };
  if (variant === 'ghost')
    return { background: 'transparent', border: 'transparent', text: colors.primary };
  if (variant === 'danger')
    return { background: colors.danger, border: colors.danger, text: colors.onDanger };
  if (variant === 'accent')
    return { background: colors.accent, border: colors.accent, text: colors.onAccent };
  return { background: colors.primary, border: colors.primary, text: colors.onPrimary };
}

export function Card({
  children,
  style,
  raised = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: raised ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
        },
        raised ? styles.cardRaised : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Avatar({
  name,
  uri,
  size = 44,
  status,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  status?: 'online' | 'away';
}) {
  const colors = useAppColors();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || '?';
  return (
    <View style={[styles.avatarWrap, { width: size, height: size }]}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={160}
          style={[
            styles.avatarImage,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.avatarFallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.primarySoft,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarInitials,
              { color: colors.primary, fontSize: Math.max(12, Math.round(size * 0.32)) },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}
      {status ? (
        <View
          style={[
            styles.presence,
            {
              backgroundColor: status === 'online' ? colors.success : colors.warning,
              borderColor: colors.surface,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  hint,
  error,
  leadingIcon,
  style,
  inputStyle,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const colors = useAppColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text> : null}
      <View
        style={[
          styles.fieldShell,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.focus : colors.borderStrong,
          },
        ]}
      >
        {leadingIcon ? (
          <MaterialIcons name={leadingIcon} size={20} color={colors.textMuted} />
        ) : null}
        <TextInput
          {...props}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.fieldInput,
            { color: colors.text },
            props.multiline ? styles.fieldMultiline : null,
            inputStyle,
          ]}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.fieldError, { color: colors.danger }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  onClear,
  autoFocus = false,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  testID?: string;
}) {
  const colors = useAppColors();
  return (
    <View
      style={[styles.search, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      <MaterialIcons name="search" size={20} color={colors.textMuted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
        style={[styles.searchInput, { color: colors.text }]}
      />
      {value && onClear ? <IconButton icon="close" label="Clear search" onPress={onClear} /> : null}
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const colors = useAppColors();
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {icon ? (
        <MaterialIcons name={icon} size={16} color={selected ? colors.primary : colors.textMuted} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}
      >
        {label}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={() => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const colors = useAppColors();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segmented,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              onChange(option.value);
            }}
            style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  overline,
}: {
  title: string;
  action?: ReactNode;
  overline?: string;
}) {
  const colors = useAppColors();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        {overline ? (
          <Text style={[styles.overline, { color: colors.primary }]}>{overline}</Text>
        ) : null}
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  numberOfLines = 1,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  numberOfLines?: number;
}) {
  const colors = useAppColors();
  const row = (
    <View style={styles.listRow}>
      {leading ? <View style={styles.listLeading}>{leading}</View> : null}
      <View style={styles.listCopy}>
        <Text numberOfLines={numberOfLines} style={[styles.listTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[styles.listSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <MaterialIcons name="chevron-right" size={22} color={colors.textSubtle} />
        ) : null)}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
    >
      {row}
    </Pressable>
  ) : (
    row
  );
}

export function EmptyState({
  title,
  body,
  icon = 'inbox',
  action,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useAppColors();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}>
        <MaterialIcons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.stateBody, { color: colors.textMuted }]}>{body}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body = 'Please check your connection and try again.',
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  const colors = useAppColors();
  return (
    <View accessibilityRole="alert" style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: '#FCE7EA' }]}>
        <MaterialIcons name="error-outline" size={28} color={colors.danger} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateBody, { color: colors.textMuted }]}>{body}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius: customRadius = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useAppColors();
  const pulse = useRef(new Animated.Value(0.42)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (reduceMotion) return undefined;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.84, duration: 780, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.42, duration: 780, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: customRadius,
          backgroundColor: colors.skeleton,
          opacity: reduceMotion ? 1 : pulse,
        },
        style,
      ]}
    />
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  const colors = useAppColors();
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonHead}>
            <Skeleton width={42} height={42} radius={21} />
            <View style={styles.skeletonHeadCopy}>
              <Skeleton width="45%" />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
          <Skeleton height={16} />
          <Skeleton width="82%" height={16} />
          <Skeleton height={170} radius={radius.md} style={{ backgroundColor: colors.skeleton }} />
        </Card>
      ))}
    </View>
  );
}

export function ModalSheet({
  visible,
  title,
  children,
  onClose,
  footer,
  testID,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  testID?: string;
}) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const layout = useAdaptiveLayout();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          style={styles.sheetKeyboard}
        >
          <View
            testID={testID}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.md),
                maxWidth: layout.isCompact ? undefined : 680,
                alignSelf: layout.isCompact ? 'stretch' : 'center',
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.sheetHeader}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={[styles.sheetTitle, { color: colors.text }]}
              >
                {title}
              </Text>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetBody}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>{footer}</View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  loading = false,
  destructive = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <View style={styles.confirmActions}>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onPress={onConfirm}
          />
        </View>
      }
    >
      <Text style={styles.confirmBody}>{body}</Text>
    </ModalSheet>
  );
}

export function CapabilityCard({
  capability,
  title,
  body,
  icon = 'auto-awesome',
}: {
  capability: Capability;
  title: string;
  body: string;
  icon?: IconName;
}) {
  const colors = useAppColors();
  const caption =
    capability === 'preview'
      ? 'Preview'
      : capability === 'unavailable'
        ? 'Unavailable'
        : 'Available';
  return (
    <Card
      style={[
        styles.capability,
        { backgroundColor: capability === 'live' ? colors.surface : colors.surfaceTint },
      ]}
    >
      <View style={[styles.capabilityIcon, { backgroundColor: colors.primarySoft }]}>
        <MaterialIcons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.capabilityCopy}>
        <Text style={[styles.capabilityCaption, { color: colors.primary }]}>{caption}</Text>
        <Text style={[styles.capabilityTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.capabilityBody, { color: colors.textMuted }]}>{body}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerCompact: { minHeight: 56 },
  headerSide: { minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerActions: { alignItems: 'center', justifyContent: 'flex-end', flexDirection: 'row' },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  headerTitle: { ...typography.title, fontSize: 20, lineHeight: 25 },
  headerSubtitle: { fontSize: 12, lineHeight: 16 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: 6,
    right: 5,
    minWidth: 10,
    height: 10,
    borderRadius: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  button: {
    minHeight: 46,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  buttonWide: { alignSelf: 'stretch' },
  buttonText: { fontSize: 15, lineHeight: 20, fontWeight: '800', flexShrink: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 0,
  },
  cardRaised: {
    shadowColor: '#201631',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    elevation: 2,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatarImage: { overflow: 'hidden' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontWeight: '800', letterSpacing: 0.2 },
  presence: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  fieldWrap: { gap: spacing.xs, minWidth: 0 },
  fieldLabel: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  fieldShell: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
  },
  fieldMultiline: { minHeight: 104, textAlignVertical: 'top' },
  fieldHint: { fontSize: 12, lineHeight: 16 },
  fieldError: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    paddingRight: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 16, lineHeight: 22 },
  chip: {
    minHeight: 36,
    maxWidth: 200,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '800', flexShrink: 1 },
  segmented: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 3,
    flexDirection: 'row',
    gap: 2,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentText: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  sectionHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
  overline: { ...typography.overline, textTransform: 'uppercase' },
  sectionTitle: { ...typography.title, fontSize: 20, lineHeight: 26 },
  listRow: {
    minHeight: 64,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  listLeading: { flexShrink: 0 },
  listCopy: { flex: 1, minWidth: 0, gap: 2 },
  listTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  listSubtitle: { fontSize: 13, lineHeight: 18 },
  state: {
    alignSelf: 'stretch',
    minHeight: 260,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stateTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  stateBody: { maxWidth: 360, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  skeletonList: { gap: spacing.md },
  skeletonCard: { gap: spacing.sm },
  skeletonHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skeletonHeadCopy: { flex: 1, gap: 8 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetKeyboard: { justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 4,
    marginTop: spacing.sm,
  },
  sheetHeader: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetTitle: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  sheetScroll: { flexShrink: 1, minHeight: 0 },
  sheetBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  sheetFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  confirmBody: { ...typography.body, color: '#5E586A' },
  capability: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  capabilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capabilityCopy: { flex: 1, minWidth: 0, gap: 2 },
  capabilityCaption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  capabilityTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  capabilityBody: { fontSize: 13, lineHeight: 18 },
});
