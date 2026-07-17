import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const brandLogo = require('../../../assets/images/logo.png');

export const sharedHeaderBaseOptions = {
  headerStyle: {
    backgroundColor: '#FFFFFF',
  },
  headerTintColor: '#111827',
  headerTitleAlign: 'left' as const,
};

export function SharedTopBarBrand() {
  return (
    <View style={styles.brandRow}>
      <Image source={brandLogo} style={styles.brandLogo} resizeMode="contain" />
      <Text style={styles.brandText}>workplace</Text>
    </View>
  );
}

type SharedTopBarSearchActionProps = {
  onPress: () => void;
  accessibilityLabel: string;
};

export function SharedTopBarSearchAction({ onPress, accessibilityLabel }: SharedTopBarSearchActionProps) {
  return (
    <View style={styles.actionsRow}>
      <Pressable
        style={styles.iconButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <MaterialIcons name="search" size={28} color="#374151" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogo: {
    width: 26,
    height: 26,
    marginRight: 8,
  },
  brandText: {
    color: '#5A4FCF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
