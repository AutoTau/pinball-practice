import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { cognito, discovery, redirectUri, refreshWithCognito, revokeWithCognito, SCOPES } from './cognito';
import { emailFromIdToken, TokenStore, type KeyValueStore, type Session } from './tokens';

// Lets the auth browser hand its result back to the waiting promise when the redirect reopens the app.
WebBrowser.maybeCompleteAuthSession();

/** The phone's keychain (iOS) / keystore (Android). Tokens never go in SQLite or plain storage. */
const keychain: KeyValueStore = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  remove: (k) => SecureStore.deleteItemAsync(k),
};

export const tokenStore = new TokenStore(keychain, (refreshToken) => {
  if (!cognito) throw new Error('Sign-in is not configured.');
  return refreshWithCognito(cognito, refreshToken);
});

export type SignInMethod = 'email' | 'google';

interface AuthContextValue {
  /** False until the stored session has been read. */
  ready: boolean;
  /** False when app.json has no auth settings, e.g. a fresh clone. */
  configured: boolean;
  session: Session | null;
  signIn(method: SignInMethod): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    tokenStore.current().then((s) => {
      if (!active) return;
      setSession(s);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (method: SignInMethod) => {
    if (!cognito) throw new Error('Sign-in is not configured.');
    const endpoints = discovery(cognito);
    const request = new AuthSession.AuthRequest({
      clientId: cognito.clientId,
      redirectUri: redirectUri(),
      scopes: SCOPES,
      usePKCE: true,
      // Google goes straight to Google; email shows Cognito's own sign-in and sign-up page.
      extraParams: method === 'google' ? { identity_provider: 'Google' } : {},
    });

    const result = await request.promptAsync(endpoints);
    if (result.type !== 'success') return; // cancelled or dismissed

    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId: cognito.clientId,
        code: result.params.code,
        redirectUri: redirectUri(),
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      endpoints,
    );
    if (!tokens.refreshToken) throw new Error('Sign-in did not return a refresh token.');

    const next: Session = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000,
      email: emailFromIdToken(tokens.idToken),
    };
    await tokenStore.save(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    const current = await tokenStore.current();
    await tokenStore.clear();
    setSession(null);
    if (current && cognito) await revokeWithCognito(cognito, current.refreshToken);
  }, []);

  const value = useMemo(
    () => ({ ready, configured: cognito !== null, session, signIn, signOut }),
    [ready, session, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
