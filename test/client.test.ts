import { describe, expect, it } from 'vitest';
import { KolHalashonClient, ShiurLanguage } from '../src/index.js';
import { fixture, fakePage, stubFetch } from './helpers.js';

const SHIURIM = fixture('ravShiurim.rav674.json');
const COUNT = fixture('ravShiurimCount.rav674.json');
const FOLDERS = fixture('ravFolders.rav674.json');

describe('request construction', () => {
  it('POSTs the search body with the site headers', async () => {
    const stub = stubFetch(() => ({ body: SHIURIM }));
    const client = new KolHalashonClient({ fetch: stub.fetch });

    await client.ravShiurim({ ravId: 674 });

    const call = stub.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://srv.kolhalashon.com/api/Search/WebSite_GetRavShiurim/');
    expect(call.headers['origin']).toBe('https://www.kolhalashon.com');
    expect(call.headers['referer']).toBe('https://www.kolhalashon.com/');
    expect(call.headers['user-agent']).toContain('Chrome/131.0.0.0');
    expect(call.headers['content-type']).toBe('application/json');
    // Not a credential: 7 random base36 characters, regenerated per request.
    expect(call.headers['authorization-site-key']).toMatch(/^Bearer [0-9a-z]{7}$/);
    expect(call.body).toMatchObject({ GeneralID: 674, FromRow: 0, NumOfRows: 24, SearchOrder: 7 });
    client.close();
  });

  it('regenerates the site key for every request', async () => {
    const stub = stubFetch(() => ({ body: SHIURIM }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    for (let i = 0; i < 20; i++) await client.ravShiurim({ ravId: 674 });
    const keys = new Set(stub.calls.map((c) => c.headers['authorization-site-key']));
    expect(keys.size).toBeGreaterThan(1);
    client.close();
  });

  it('applies the client default language to the search body', async () => {
    const stub = stubFetch(() => ({ body: SHIURIM }));
    const client = new KolHalashonClient({ fetch: stub.fetch, language: ShiurLanguage.HEBREW });
    await client.ravShiurim({ ravId: 674 });
    expect(stub.calls[0]!.body).toMatchObject({ PrefferedLanguage: 1 });
    client.close();
  });
});

describe('ravShiurim', () => {
  it('returns a parsed page with paging context', async () => {
    const stub = stubFetch(() => ({ body: SHIURIM }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const page = await client.ravShiurim({ ravId: 674, rowsPerPage: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]!.ravNameHebrew).toBe('הרב אלימלך בידרמן');
    expect(page.fromRow).toBe(0);
    expect(page.rowsPerPage).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.skipped).toBe(0);
    client.close();
  });

  it('counts skipped rows without dropping the page', async () => {
    const stub = stubFetch(() => ({ body: JSON.stringify([{ nope: 1 }, JSON.parse(SHIURIM)[0]]) }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const page = await client.ravShiurim({ ravId: 674, rowsPerPage: 24 });
    expect(page.items).toHaveLength(1);
    expect(page.skipped).toBe(1);
    client.close();
  });
});

describe('ravShiurimCount', () => {
  it('reads VarInt out of the scalar envelope', async () => {
    const stub = stubFetch(() => ({ body: COUNT }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    expect(await client.ravShiurimCount(674)).toBe(5852);
    expect(stub.calls[0]!.url).toBe(
      'https://srv.kolhalashon.com/api/Ravs/WebSite_GetRavShiurimCount/674/-1',
    );
    expect(stub.calls[0]!.method).toBe('GET');
    client.close();
  });

  it('passes an explicit language into the path', async () => {
    const stub = stubFetch(() => ({ body: COUNT }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    await client.ravShiurimCount(674, ShiurLanguage.YIDDISH);
    expect(stub.calls[0]!.url).toBe(
      'https://srv.kolhalashon.com/api/Ravs/WebSite_GetRavShiurimCount/674/3',
    );
    client.close();
  });
});

describe('ravFolders', () => {
  it('parses the folder list', async () => {
    const stub = stubFetch(() => ({ body: FOLDERS }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const folders = await client.ravFolders(674);
    expect(folders).toHaveLength(2);
    expect(stub.calls[0]!.url).toBe(
      'https://srv.kolhalashon.com/api/Ravs/GetRavMainFolders/674/-1',
    );
    client.close();
  });
});

describe('newestShiur', () => {
  it('asks for a single row', async () => {
    const stub = stubFetch(() => ({ body: fakePage(1) }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const shiur = await client.newestShiur(674);
    expect(shiur?.fileId).toBe(40000000);
    expect(stub.calls[0]!.body).toMatchObject({ NumOfRows: 1, SearchOrder: 7 });
    client.close();
  });

  it('returns null when the rav has nothing', async () => {
    const stub = stubFetch(() => ({ body: '[]' }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    expect(await client.newestShiur(999999)).toBeNull();
    client.close();
  });
});

describe('close', () => {
  it('refuses further calls', async () => {
    const stub = stubFetch(() => ({ body: SHIURIM }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    client.close();
    await expect(client.ravShiurim({ ravId: 674 })).rejects.toThrow(/closed/);
    expect(stub.calls).toHaveLength(0);
  });

  it('is idempotent', () => {
    const stub = stubFetch(() => ({ body: SHIURIM }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    client.close();
    expect(() => client.close()).not.toThrow();
  });
});
