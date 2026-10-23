/**
 * @jest-environment node
 */
import { catalogMachine, loadCatalog, refreshCatalog, type FetchLike } from '@/data/catalog';
import { addMachineInstance, machineListQuery, sessionListQuery, startSession } from '@/data/practice';
import { createTestClock, createTestDb } from '@/test/testDb';

const machine = (opdbId: string, name: string, extra: object = {}) => ({
  opdbId,
  opdbMachineId: opdbId.split('-').slice(0, 2).join('-'),
  opdbAliasId: opdbId.split('-').length === 3 ? opdbId : null,
  name,
  shortName: null,
  titleGroupName: name.split(' (')[0],
  manufacturer: 'Stern',
  year: 2021,
  display: 'lcd',
  retired: false,
  pinballPrimerUrl: null,
  pinballRulesUrl: null,
  bobsGuideUrl: null,
  ...extra,
});

/** A fake API that serves `machines` with ETag `etag` and honors If-None-Match. */
function fakeApi(machines: object[], etag = '"catalog-7"') {
  const calls: Record<string, string>[] = [];
  const fetchFn: FetchLike = async (_url, init) => {
    calls.push(init.headers);
    const notModified = init.headers['If-None-Match'] === etag;
    return {
      status: notModified ? 304 : 200,
      headers: { get: (h: string) => (h.toLowerCase() === 'etag' ? etag : null) },
      json: async () => ({ version: 7, machines }),
    };
  };
  return { fetchFn, calls };
}

describe('offline catalog', () => {
  it('downloads the catalog, then sends the ETag and skips an unchanged one', async () => {
    const db = createTestDb();
    const api = fakeApi([machine('GweeP-MW95j', 'Godzilla (Pro)'), machine('GweeP-Ml9pZ-ARZoY', 'Godzilla (Premium)')]);

    expect(await refreshCatalog(db, api.fetchFn, 'http://api')).toBe('updated');
    expect(await refreshCatalog(db, api.fetchFn, 'http://api')).toBe('unchanged');

    expect(api.calls).toEqual([{}, { 'If-None-Match': '"catalog-7"' }]);
    expect(loadCatalog(db)).toHaveLength(2);
    expect(catalogMachine(db, 'GweeP-Ml9pZ-ARZoY')?.opdbMachineId).toBe('GweeP-Ml9pZ');
  });

  it('replaces the whole catalog when a new version arrives', async () => {
    const db = createTestDb();
    await refreshCatalog(db, fakeApi([machine('A-M1', 'Old')], '"catalog-1"').fetchFn, 'http://api');

    await refreshCatalog(db, fakeApi([machine('B-M2', 'New')], '"catalog-2"').fetchFn, 'http://api');

    expect(loadCatalog(db).map((c) => c.name)).toEqual(['New']);
  });

  it('keeps the current catalog when a download fails or comes back empty', async () => {
    const db = createTestDb();
    await refreshCatalog(db, fakeApi([machine('A-M1', 'Kept')]).fetchFn, 'http://api');

    const failing: FetchLike = async () => ({ status: 503, headers: { get: () => null }, json: async () => ({}) });
    await expect(refreshCatalog(db, failing, 'http://api')).rejects.toThrow(/HTTP 503/);
    await expect(refreshCatalog(db, fakeApi([], '"catalog-9"').fetchFn, 'http://api')).rejects.toThrow(/empty/);

    expect(loadCatalog(db).map((c) => c.name)).toEqual(['Kept']);
  });

  it('names machines and sessions from the catalog, preferring the alias', async () => {
    const db = createTestDb();
    const clock = createTestClock();
    await refreshCatalog(db, fakeApi([machine('GweeP-Ml9pZ-ARZoY', 'Godzilla (Premium)')]).fetchFn, 'http://api');
    const machineId = addMachineInstance(db, clock, {
      opdbMachineId: 'GweeP-Ml9pZ',
      opdbAliasId: 'GweeP-Ml9pZ-ARZoY',
      locationName: 'Ground Kontrol',
    });
    startSession(db, clock, { machineInstanceId: machineId });

    expect(machineListQuery(db).all()[0]).toMatchObject({ machineName: 'Godzilla (Premium)', locationName: 'Ground Kontrol' });
    expect(sessionListQuery(db).all()[0].machineName).toBe('Godzilla (Premium)');
  });
});
