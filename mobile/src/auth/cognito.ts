import { isRunningInExpoGo } from 'expo';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';

import { SignedOutError, type RefreshedTokens } from './tokens';

// Cognito's hosted ("managed") login, used as a plain OAuth 2.0 / OIDC provider with PKCE (decision 39).
// The app client is public (no secret), so nothing here is sensitive; values live in app.json extra.auth.

export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  /** e.g. https://us-west-2abc.auth.us-west-2.amazoncognito.com */
  domain: string;
}

export const cognito: CognitoConfig | null = (() => {
  const auth = Constants.expoConfig?.extra?.auth as Partial<CognitoConfig> | undefined;
  return auth?.userPoolId && auth.clientId && auth.domain && auth.region ? (auth as CognitoConfig) : null;
})();

export const SCOPES = ['openid', 'email', 'profile'];

export function discovery(config: CognitoConfig): AuthSession.DiscoveryDocument {
  return {
    authorizationEndpoint: `${config.domain}/oauth2/authorize`,
    tokenEndpoint: `${config.domain}/oauth2/token`,
    revocationEndpoint: `${config.domain}/oauth2/revoke`,
  };
}

/**
 * Where Cognito sends the browser back: exp://<dev server>/--/auth in Expo Go, pinballpractice://auth in a
 * real build. Both must be allowed callback URLs on the app client.
 *
 * Built by hand because Expo Go (SDK 58) reports executionEnvironment "bare", so makeRedirectUri and
 * Linking.createURL both returned the build-only pinballpractice:// URL, which nothing on the phone
 * opens, and sign-in never came back. isRunningInExpoGo checks for Expo Go's native module instead.
 */
export function redirectUri(): string {
  const devServer = Constants.expoConfig?.hostUri;
  return isRunningInExpoGo() && devServer ? `exp://${devServer}/--/auth` : 'pinballpractice://auth';
}

/** Exchanges a refresh token for a new access token; a rejected token means the user must sign in again. */
export async function refreshWithCognito(config: CognitoConfig, refreshToken: string): Promise<RefreshedTokens> {
  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: refreshToken }).toString(),
  });
  if (response.status === 400 || response.status === 401) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SignedOutError(body.error ?? 'invalid_grant');
  }
  if (!response.ok) throw new Error(`Token refresh failed (HTTP ${response.status}).`);
  const tokens = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return { accessToken: tokens.access_token, expiresIn: tokens.expires_in, refreshToken: tokens.refresh_token };
}

/** Revokes the refresh token on sign-out, so a copy of it can't be used later. Best effort. */
export async function revokeWithCognito(config: CognitoConfig, refreshToken: string): Promise<void> {
  await fetch(`${config.domain}/oauth2/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken, client_id: config.clientId }).toString(),
  }).catch(() => undefined);
}
