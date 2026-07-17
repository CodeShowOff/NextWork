import React from 'react';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppHeader, IconButton } from '../shared/ui/AppUI';

function rootNavigation(navigation: NativeStackHeaderProps['navigation']) {
  return navigation.getParent()?.getParent() ?? navigation.getParent() ?? navigation;
}

export function AppStackHeader({ navigation, options, back, route }: NativeStackHeaderProps) {
  const { t } = useTranslation();
  const title = typeof options.title === 'string' ? options.title : t('ui.headers.profile');
  const root = rootNavigation(navigation);
  return (
    <AppHeader
      title={title}
      onBack={back ? () => navigation.goBack() : undefined}
      backLabel={t('ui.actions.back')}
      actions={!back ? <>
        <IconButton testID="header-search" icon="search" label={t('ui.actions.search')} onPress={() => (root as any).navigate('Search')} />
        {route.name !== 'MyProfile' ? <IconButton testID="header-profile" icon="account-circle" label={t('ui.actions.profile')} onPress={() => (root as any).navigate('Profile')} /> : null}
        <IconButton testID="header-settings" icon="settings" label={t('ui.actions.settings')} onPress={() => (root as any).navigate('Settings')} />
      </> : undefined}
    />
  );
}
