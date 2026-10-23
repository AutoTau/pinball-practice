import { emailFromIdToken, SignedOutError, TokenStore, type KeyValueStore, type RefreshedTokens } from '@/auth/tokens';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
}

const session = (expiresAt: number) => ({ accessToken: 'old', refreshToken: 'r1', expiresAt, email: 'a@b.test' });

describe('TokenStore', () => {
  it('returns null when signed out and the stored token while it is fresh', async () => {
    const store = new TokenStore(memoryStore(), jest.fn(), () => 0);
    expect(await store.accessToken()).toBeNull();

    await store.save(session(10 * 60_000));
    expect(await store.accessToken()).toBe('old');
  });

  it('restores the session from storage after a restart', async () => {
    const kv = memoryStore();
    await new TokenStore(kv, jest.fn(), () => 0).save(session(10 * 60_000));

    expect((await new TokenStore(kv, jest.fn(), () => 0).current())?.email).toBe('a@b.test');
  });

  it('refreshes shortly before expiry, keeps the refresh token, and shares one refresh between callers', async () => {
    let now = 0;
    const refresh = jest.fn(async (): Promise<RefreshedTokens> => ({ accessToken: 'new', expiresIn: 3600 }));
    const store = new TokenStore(memoryStore(), refresh, () => now);
    await store.save(session(90_000));
    now = 45_000; // 45 s left: inside the one-minute margin

    const [a, b] = await Promise.all([store.accessToken(), store.accessToken()]);

    expect([a, b]).toEqual(['new', 'new']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('r1');
    expect(await store.current()).toMatchObject({ refreshToken: 'r1', expiresAt: 45_000 + 3_600_000 });
  });

  it('signs out when the refresh token is rejected, but not when the network fails', async () => {
    const kv = memoryStore();
    const offline = new TokenStore(kv, async () => Promise.reject(new TypeError('Network request failed')), () => 0);
    await offline.save(session(0));
    await expect(offline.accessToken()).rejects.toThrow('Network request failed');
    expect(await offline.current()).not.toBeNull();

    const rejected = new TokenStore(kv, async () => Promise.reject(new SignedOutError('invalid_grant')), () => 0);
    expect(await rejected.accessToken()).toBeNull();
    expect(kv.data.size).toBe(0);
  });
});

describe('emailFromIdToken', () => {
  const token = (payload: object) =>
    ['x', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');

  it('reads the email claim, including non-ASCII', () => {
    expect(emailFromIdToken(token({ email: 'zoë@example.test' }))).toBe('zoë@example.test');
  });

  it('returns null for missing or malformed tokens', () => {
    expect(emailFromIdToken(undefined)).toBeNull();
    expect(emailFromIdToken('not-a-jwt')).toBeNull();
    expect(emailFromIdToken(token({ sub: '1' }))).toBeNull();
  });
});
