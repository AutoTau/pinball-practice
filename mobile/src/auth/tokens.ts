// The signed-in session and its tokens (decision 39). Storage and the refresh call are injected, so the
// rules here are tested in Node; the app plugs in the keychain (expo-secure-store) and Cognito.

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
  email: string | null;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface RefreshedTokens {
  accessToken: string;
  /** Seconds until the new access token expires. */
  expiresIn: number;
  /** Cognito keeps the same refresh token unless rotation is on, so this is usually absent. */
  refreshToken?: string;
}

/** Thrown by a refresher when the server rejects the refresh token, i.e. the user must sign in again. */
export class SignedOutError extends Error {}

const KEY = 'pinball.session';
/** Refresh this early, so a token never expires mid-request. */
const REFRESH_MARGIN_MS = 60_000;

export class TokenStore {
  private session: Session | null | undefined; // undefined: not loaded yet
  private refreshing: Promise<string | null> | null = null;

  constructor(
    private readonly store: KeyValueStore,
    private readonly refresh: (refreshToken: string) => Promise<RefreshedTokens>,
    private readonly now: () => number = Date.now,
  ) {}

  async current(): Promise<Session | null> {
    if (this.session === undefined) {
      const raw = await this.store.get(KEY);
      this.session = raw ? (JSON.parse(raw) as Session) : null;
    }
    return this.session;
  }

  async save(session: Session): Promise<void> {
    this.session = session;
    await this.store.set(KEY, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    this.session = null;
    await this.store.remove(KEY);
  }

  /**
   * A valid access token, refreshing it first if it's about to expire; null when signed out. Concurrent
   * callers share one refresh. A network failure throws (try later); a rejected refresh token signs out.
   */
  async accessToken(): Promise<string | null> {
    const session = await this.current();
    if (!session) return null;
    if (session.expiresAt - this.now() > REFRESH_MARGIN_MS) return session.accessToken;

    this.refreshing ??= this.refreshSession(session).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refreshSession(session: Session): Promise<string | null> {
    try {
      const fresh = await this.refresh(session.refreshToken);
      await this.save({
        ...session,
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken ?? session.refreshToken,
        expiresAt: this.now() + fresh.expiresIn * 1000,
      });
      return fresh.accessToken;
    } catch (e) {
      if (e instanceof SignedOutError) {
        await this.clear();
        return null;
      }
      throw e;
    }
  }
}

/** Reads the email claim from an ID token. Display only: the token was just issued by Cognito over TLS. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(base64UrlDecode(payload)) as { email?: unknown };
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(text: string): string {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return decodeURIComponent(
    Array.from(atob(base64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  );
}
