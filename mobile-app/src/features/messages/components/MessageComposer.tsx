import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface Props {
  isSending: boolean;
  onSend: (text: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
}

export function MessageComposer({ isSending, onSend, onTypingChange }: Props) {
  const [value, setValue] = useState('');
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTypingState = (isTyping: boolean) => {
    if (isTypingRef.current === isTyping) {
      return;
    }

    isTypingRef.current = isTyping;
    onTypingChange?.(isTyping);
  };

  const handleChangeText = (nextValue: string) => {
    setValue(nextValue);

    const hasContent = nextValue.trim().length > 0;
    if (!hasContent) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      emitTypingState(false);
      return;
    }

    emitTypingState(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingState(false);
    }, 1200);
  };

  const submit = () => {
    const next = value.trim();
    if (!next) {
      return;
    }

    setValue('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTypingState(false);
    onSend(next);
  };

  return (
    <View style={styles.root}>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        placeholder="Type a message"
        style={styles.input}
        multiline
      />
      <Pressable style={[styles.button, isSending ? styles.disabledButton : null]} onPress={submit}>
        <Text style={styles.buttonText}>{isSending ? '...' : 'Send'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 120,
    backgroundColor: '#F8FAFC',
  },
  button: {
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
