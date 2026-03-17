import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ConversationDetailScreen } from './ConversationDetailScreen';
import { ConversationsScreen } from './ConversationsScreen';

export type MessagesStackParamList = {
  Conversations: undefined;
  ConversationDetail: {
    conversationId: string;
  };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: t('app.tabs.messages') }} />
      <Stack.Screen
        name="ConversationDetail"
        component={ConversationDetailScreen}
        options={{ title: t('app.stack.conversation') }}
      />
    </Stack.Navigator>
  );
}
