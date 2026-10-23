import Constants from 'expo-constants';

const API_PORT = 5080;

/**
 * Base URL of the API. Set EXPO_PUBLIC_API_URL to override. In development it defaults to the computer
 * running Metro (the host Expo Go loaded the app from), so a phone on the same Wi-Fi reaches a local API.
 */
export const apiUrl: string = (() => {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${API_PORT}`;
})();
