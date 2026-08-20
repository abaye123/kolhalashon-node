import { describe, expect, it } from 'vitest';
import { KolHalashonClient, type Shiur } from '../src/index.js';
import { fakePage, stubFetch } from './helpers.js';

/** Three full pages of 3 then a short page of 1: the walk must stop after the short page. */
function pagedStub() {
  return stubFetch((call) => {
    const from = (call.body as { FromRow: number }).FromRow;
    const rows = from >= 9 ? 1 : 3;
    return { body: fakePage(rows, 40000000 + from) };
  });
}

describe('allRavShiurim', () => {
  it('walks pages until the server returns a short one', async () => {
    const stub = pagedStub();
    const client = new KolHalashonClient({ fetch: stub.fetch });

    const ids: number[] = [];
    for await (const shiur of client.allRavShiurim({ ravId: 674, rowsPerPage: 3 })) {
      ids.push(shiur.fileId);
    }

    expect(ids).toHaveLength(10);
    expect(stub.calls.map((c) => (c.body as { FromRow: number }).FromRow)).toEqual([0, 3, 6, 9]);
    client.close();
  });

  it('starts at query.fromRow', async () => {
    const stub = pagedStub();
    const client = new KolHalashonClient({ fetch: stub.fetch });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of client.allRavShiurim({ ravId: 674, fromRow: 6, rowsPerPage: 3 })) {
      // drain
    }
    expect(stub.calls.map((c) => (c.body as { FromRow: number }).FromRow)).toEqual([6, 9]);
    client.close();
  });

  it('is lazy: nothing is fetched before the first pull', async () => {
    const stub = pagedStub();
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const gen = client.allRavShiurim({ ravId: 674, rowsPerPage: 3 });
    expect(stub.calls).toHaveLength(0);
    await gen.next();
    expect(stub.calls).toHaveLength(1);
    await gen.return(undefined);
    client.close();
  });

  it('fetches no further pages once the consumer stops', async () => {
    const stub = pagedStub();
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const collected: Shiur[] = [];
    for await (const shiur of client.allRavShiurim({ ravId: 674, rowsPerPage: 3 })) {
      collected.push(shiur);
      if (collected.length === 4) break;
    }
    // 4 items means exactly 2 pages were needed; the walk must not have run ahead.
    expect(stub.calls).toHaveLength(2);
    client.close();
  });

  it('is cancellable through an AbortSignal', async () => {
    // One row per page, so every pull needs a request and the abort lands on the next one.
    const stub = stubFetch((call) => ({
      body: fakePage(1, 40000000 + (call.body as { FromRow: number }).FromRow),
    }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
    const controller = new AbortController();
    const gen = client.allRavShiurim({ ravId: 674, rowsPerPage: 1 }, { signal: controller.signal });

    await gen.next();
    expect(stub.calls).toHaveLength(1);
    controller.abort();

    await expect(gen.next()).rejects.toThrow(/cancelled/);
    expect(stub.calls).toHaveLength(1);
    client.close();
  });
});

describe('ravShiurimBulk', () => {
  it('fetches a known total with bounded concurrency and preserves order', async () => {
    let inFlight = 0;
    let peak = 0;
    const stub = stubFetch((call) => {
      const from = (call.body as { FromRow: number }).FromRow;
      return { body: fakePage(5, 40000000 + from) };
    });
    const counting = async (url: string, init: RequestInit) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      try {
        // A microtask hop is enough to interleave the pool's workers.
        await Promise.resolve();
        return await stub.fetch(url, init);
      } finally {
        inFlight--;
      }
    };

    const client = new KolHalashonClient({ fetch: counting });
    const items = await client.ravShiurimBulk({ ravId: 674, rowsPerPage: 5 }, 23);

    expect(items).toHaveLength(23);
    expect(items[0]!.fileId).toBe(40000000);
    expect(items[5]!.fileId).toBe(40000005);
    expect(items[22]!.fileId).toBe(40000022);
    expect(stub.calls).toHaveLength(5);
    expect(peak).toBeLessThanOrEqual(4);
    client.close();
  });

  it('honours an explicit concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const stub = stubFetch((call) => ({
      body: fakePage(2, 40000000 + (call.body as { FromRow: number }).FromRow),
    }));
    const counting = async (url: string, init: RequestInit) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      try {
        await Promise.resolve();
        return await stub.fetch(url, init);
      } finally {
        inFlight--;
      }
    };
    const client = new KolHalashonClient({ fetch: counting, concurrency: 2 });
    await client.ravShiurimBulk({ ravId: 674, rowsPerPage: 2 }, 20);
    expect(peak).toBeLessThanOrEqual(2);
    client.close();
  });

  it('rejects a nonsense total', async () => {
    const stub = stubFetch(() => ({ body: '[]' }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    await expect(client.ravShiurimBulk({ ravId: 674 }, -1)).rejects.toThrow(TypeError);
    client.close();
  });
});
