import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ConversationDetailScreen } from './ConversationDetailScreen';
import { ConversationsScreen } from './ConversationsScreen';
import { SharedTopBarBrand, SharedTopBarSearchAction, sharedHeaderBaseOptions } from '../../../shared/ui/SharedTopBar';

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
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...sharedHeaderBaseOptions,
        headerRight: () => (
          <SharedTopBarSearchAction
            onPress={() => navigation.getParent()?.navigate('Search' as never)}
            accessibilityLabel={t('app.tabs.search')}
          />
        ),
      })}
    >
      <Stack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{
          headerTitle: () => <SharedTopBarBrand />,
        }}
      />
      <Stack.Screen
        name="ConversationDetail"
        component={ConversationDetailScreen}
        options={{ title: t('app.stack.conversation') }}
      />
    </Stack.Navigator>
  );
}
