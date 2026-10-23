import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { tokenStore, useAuth } from '@/auth/AuthProvider';
import { apiUrl } from '@/config';
import { clock, db } from '@/db/client';

import { syncNow, type SyncSummary } from './engine';
import { httpSyncServer } from './httpServer';

const server = httpSyncServer(apiUrl, () => tokenStore.accessToken());

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncContextValue {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  lastSummary: SyncSummary | null;
  error: string | null;
  /** Starts a sync unless one is running or nobody is signed in. Never throws. */
  requestSync(): void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Runs sync when it's likely useful: right after sign-in, whenever the app returns to the foreground, and
 * when a screen asks (after a game ends). One sync at a time; offline failures just wait for the next try.
 */
export function SyncProvider(props: { children: ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const signedIn = session !== null;

  const requestSync = useCallback(() => {
    if (!signedIn || running.current) return;
    running.current = true;
    setStatus('syncing');
    syncNow(db, server, clock)
      .then((summary) => {
        setLastSummary(summary);
        setLastSyncedAt(new Date());
        setError(null);
        setStatus('idle');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      })
      .finally(() => {
        running.current = false;
      });
  }, [signedIn]);

  // Sync on sign-in (and app start when already signed in), then each time the app comes to the front.
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(requestSync, 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [signedIn, requestSync]);

  const value = useMemo(
    () => ({ status, lastSyncedAt, lastSummary, error, requestSync }),
    [status, lastSyncedAt, lastSummary, error, requestSync],
  );
  return <SyncContext.Provider value={value}>{props.children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider.');
  return value;
}
