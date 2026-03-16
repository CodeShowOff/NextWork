export function extractInviteToken(url: string): string | null {
  try {
    const parsed = new URL(url);

    const queryToken = parsed.searchParams.get('inviteToken') ?? parsed.searchParams.get('token');
    if (queryToken?.trim()) {
      return queryToken.trim();
    }

    const segments = parsed.pathname.split('/').filter(Boolean);

    if (parsed.hostname.toLowerCase() === 'invite' && segments[0]) {
      return segments[0].trim();
    }

    const inviteIndex = segments.findIndex((segment) => segment.toLowerCase() === 'invite');
    if (inviteIndex >= 0 && segments[inviteIndex + 1]) {
      return segments[inviteIndex + 1].trim();
    }
  } catch {
    return null;
  }

  return null;
}
