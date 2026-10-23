import { Redirect } from 'expo-router';

/**
 * Target of the sign-in redirect (pinballpractice://auth). The auth browser normally consumes it, but if
 * the system opens the app with it instead, land on Profile rather than an "unmatched route" screen.
 */
export default function AuthRedirect() {
  return <Redirect href="/profile" />;
}
