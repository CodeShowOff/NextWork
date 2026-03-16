import { useSessionStore } from '../session/session.store';

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { accessToken, apiBaseUrl } = useSessionStore.getState();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
