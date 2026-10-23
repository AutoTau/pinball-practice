import type { PullResponse, PushRequest, PushResult, SyncServer } from './contract';

export class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The real sync server over HTTP. `getToken` returns the signed-in user's access token (decision 39). */
export function httpSyncServer(apiUrl: string, getToken: () => Promise<string | null>, fetchFn: typeof fetch = fetch): SyncServer {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    if (!token) throw new SyncHttpError(401, 'Not signed in.');

    const response = await fetchFn(`${apiUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!response.ok) throw new SyncHttpError(response.status, `Sync request failed (HTTP ${response.status}).`);
    return (await response.json()) as T;
  }

  return {
    push: (request: PushRequest) =>
      call<{ results: PushResult[] }>('/sync/push', { method: 'POST', body: JSON.stringify(request) }),
    pull: (cursor: string | null) =>
      call<PullResponse>(`/sync/pull${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  };
}
