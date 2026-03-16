import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
  return (
    <Stack.Navigator>
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Messages' }} />
      <Stack.Screen
        name="ConversationDetail"
        component={ConversationDetailScreen}
        options={{ title: 'Conversation' }}
      />
    </Stack.Navigator>
  );
}
