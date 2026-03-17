import i18next from 'i18next';

import { resources } from './resources';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return flattenKeys(nested, next);
    }

    return [next];
  });
}

describe('i18n resources', () => {
  it('contains expected core namespaces for English baseline', () => {
    const keys = flattenKeys(resources.en.translation);

    expect(keys).toContain('auth.title');
    expect(keys).toContain('feed.composer.placeholder');
    expect(keys).toContain('groups.title.activeOrganization');
    expect(keys).toContain('search.title');
    expect(keys).toContain('messages.setup.title');
    expect(keys).toContain('messages.composer.placeholder');
    expect(keys).toContain('messages.detail.typingSingle');
    expect(keys).toContain('notifications.title');
    expect(keys).toContain('notifications.item.follow');
    expect(keys).toContain('profile.title.mine');
    expect(keys).toContain('profile.followList.empty');
    expect(keys).toContain('feed.detail.writeCommentPlaceholder');
  });

  it('falls back to English when locale key is missing', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      resources,
      lng: 'en-XA',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });

    expect(i18n.t('groups.title.activeOrganization')).toBe('Active organization');
  });

  it('uses pseudo locale strings for smoke and layout checks', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      resources,
      lng: 'en-XA',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });

    const pseudoTitle = i18n.t('app.tabs.notifications');
    expect(pseudoTitle).toContain('Expanded');
  });

  it('includes real non-English locales for release localization checks', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      resources,
      lng: 'es',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });

    expect(i18n.t('app.tabs.feed')).toBe('Inicio');

    await i18n.changeLanguage('fr');
    expect(i18n.t('app.tabs.feed')).toBe('Fil');
  });
});
