export const GROUP_TYPE_OPTIONS = [
  'Teams & Projects',
  'Discussions',
  'Announcements',
  'Social & More',
] as const;

export const GROUP_PRIVACY_OPTIONS = ['Open', 'Closed', 'Secret'] as const;

export const DEFAULT_GROUP_TYPE = GROUP_TYPE_OPTIONS[0];
export const DEFAULT_GROUP_PRIVACY = GROUP_PRIVACY_OPTIONS[0];