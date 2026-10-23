import { useCallback, useEffect, useState } from 'react';

import { apiUrl } from '@/config';
import { loadCatalog, refreshCatalog, type CatalogMachine } from '@/data/catalog';
import { db } from '@/db/client';

export type CatalogStatus = 'loading' | 'ready' | 'offline';

/**
 * The offline catalog, refreshed from the API when the screen opens. If the API can't be reached the
 * stored copy is used; only a phone that has never downloaded it has nothing to search.
 */
export function useCatalog() {
  const [machines, setMachines] = useState<CatalogMachine[]>(() => loadCatalog(db));
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  // Bumped by a manual retry to re-run the refresh effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true; // ignore results that land after the screen closes
    refreshCatalog(db, fetch, apiUrl).then(
      (result) => {
        if (!active) return;
        if (result === 'updated') setMachines(loadCatalog(db));
        setError(null);
        setStatus('ready');
      },
      (e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('offline');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  return { machines, status, error, refresh };
}
