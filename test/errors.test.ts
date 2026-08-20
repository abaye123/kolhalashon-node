import { describe, expect, it } from 'vitest';
import {
  KolHalashonClient,
  KolHalashonError,
  KolHalashonHttpError,
  KolHalashonLockedError,
  KolHalashonNotFoundError,
  KolHalashonParseError,
  KolHalashonRateLimitedError,
} from '../src/index.js';
import { fixture, stubFetch } from './helpers.js';

const CHALLENGE = fixture('cloudflare403.html');

describe('403 with an HTML body', () => {
  it('is reported as rate limiting, not as an auth failure', async () => {
    const stub = stubFetch(() => ({
      status: 403,
      contentType: 'text/html; charset=UTF-8',
      body: CHALLENGE,
    }));
    const client = new KolHalashonClient({ fetch: stub.fetch });

    const err = await client.ravShiurim({ ravId: 674 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KolHalashonRateLimitedError);
    expect(err).toBeInstanceOf(KolHalashonError);
    const rate = err as KolHalashonRateLimitedError;
    expect(rate.status).toBe(403);
    expect(rate.suggestedBackoffSeconds).toBeGreaterThan(0);
    expect(rate.message).toMatch(/back off/i);
    expect(rate.message).toMatch(/not an auth failure/i);
    expect(rate.message).toContain('ravShiurim(rav 674');
    expect(rate.bodyExcerpt).toContain('Just a moment...');
    client.close();
  });

  it('is not retried, because retrying makes it worse', async () => {
    const stub = stubFetch(() => ({
      status: 403,
      contentType: 'text/html',
      body: CHALLENGE,
    }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 3 });
    await expect(client.ravShiurimCount(674)).rejects.toBeInstanceOf(KolHalashonRateLimitedError);
    expect(stub.calls).toHaveLength(1);
    client.close();
  });

  it('also recognises 429 and 503 challenge pages', async () => {
    for (const status of [429, 503]) {
      const stub = stubFetch(() => ({ status, contentType: 'text/html', body: CHALLENGE }));
      const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
      await expect(client.ravShiurim({ ravId: 674 })).rejects.toBeInstanceOf(
        KolHalashonRateLimitedError,
      );
      client.close();
    }
  });

  it('leaves a genuine JSON 403 as an ordinary HTTP error', async () => {
    const stub = stubFetch(() => ({
      status: 403,
      contentType: 'application/json',
      body: '{"Message":"Forbidden"}',
    }));
    const client = new KolHalashonClient({ fetch: stub.fetch });
    const err = await client.ravShiurim({ ravId: 674 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KolHalashonHttpError);
    expect(err).not.toBeInstanceOf(KolHalashonRateLimitedError);
    client.close();
  });
});

describe('404', () => {
  it('becomes KolHalashonNotFoundError and names the operation', async () => {
    const stub = stubFetch(() => ({ status: 404, body: 'Not Found', contentType: 'text/plain' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 3 });
    const err = await client.ravFolders(999999).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KolHalashonNotFoundError);
    expect((err as Error).message).toContain('ravFolders(rav 999999)');
    expect(stub.calls).toHaveLength(1); // not retried
    client.close();
  });

  it('treats an empty 200 body as not found', async () => {
    const stub = stubFetch(() => ({ body: '' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
    await expect(client.ravShiurimCount(674)).rejects.toBeInstanceOf(KolHalashonNotFoundError);
    client.close();
  });
});

describe('500', () => {
  it('becomes KolHalashonHttpError carrying status, url and an excerpt', async () => {
    const stub = stubFetch(() => ({
      status: 500,
      contentType: 'text/plain',
      body: 'Server Error\n   at Something',
    }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
    const err = await client.ravShiurim({ ravId: 674 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KolHalashonHttpError);
    const http = err as KolHalashonHttpError;
    expect(http.status).toBe(500);
    expect(http.url).toContain('WebSite_GetRavShiurim');
    expect(http.bodyExcerpt).toBe('Server Error at Something');
    client.close();
  });

  it('is retried for idempotent GETs, then given up on', async () => {
    const stub = stubFetch(() => ({ status: 500, contentType: 'text/plain', body: 'boom' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 2 });
    await expect(client.ravShiurimCount(674)).rejects.toBeInstanceOf(KolHalashonHttpError);
    expect(stub.calls).toHaveLength(3);
    client.close();
  });

  it('succeeds when a retry succeeds', async () => {
    const stub = stubFetch((_call, index) =>
      index === 0
        ? { status: 500, contentType: 'text/plain', body: 'boom' }
        : { body: fixture('ravShiurimCount.rav674.json') },
    );
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 2 });
    expect(await client.ravShiurimCount(674)).toBe(5852);
    expect(stub.calls).toHaveLength(2);
    client.close();
  });

  it('does not retry a POST, because it is not declared idempotent', async () => {
    const stub = stubFetch(() => ({ status: 500, contentType: 'text/plain', body: 'boom' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 3 });
    await expect(client.ravShiurim({ ravId: 674 })).rejects.toBeInstanceOf(KolHalashonHttpError);
    expect(stub.calls).toHaveLength(1);
    client.close();
  });
});

describe('malformed JSON', () => {
  it('becomes KolHalashonParseError with the raw excerpt', async () => {
    const stub = stubFetch(() => ({ body: '{"VarInt": 585' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
    const err = await client.ravShiurimCount(674).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KolHalashonParseError);
    const parse = err as KolHalashonParseError;
    expect(parse.rawExcerpt).toBe('{"VarInt": 585');
    expect(parse.message).toContain('not valid JSON');
    client.close();
  });

  it('rejects a well-formed body of the wrong shape', async () => {
    const stub = stubFetch(() => ({ body: '{"not":"an array"}' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
    await expect(client.ravShiurim({ ravId: 674 })).rejects.toBeInstanceOf(KolHalashonParseError);
    await expect(client.ravFolders(674)).rejects.toBeInstanceOf(KolHalashonParseError);
    client.close();
  });

  it('is not retried: a bad body will not parse better on the second try', async () => {
    const stub = stubFetch(() => ({ body: '{"VarInt": 585' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 3 });
    await expect(client.ravShiurimCount(674)).rejects.toBeInstanceOf(KolHalashonParseError);
    expect(stub.calls).toHaveLength(1);
    client.close();
  });

  it('rejects a count envelope with no VarInt', async () => {
    const stub = stubFetch(() => ({ body: '{"VarString":null}' }));
    const client = new KolHalashonClient({ fetch: stub.fetch, retries: 0 });
    await expect(client.ravShiurimCount(674)).rejects.toBeInstanceOf(KolHalashonParseError);
    client.close();
  });
});

describe('transport failures', () => {
  it('wraps a thrown fetch in KolHalashonError', async () => {
    const client = new KolHalashonClient({
      fetch: () => Promise.reject(new Error('ECONNRESET')),
      retries: 0,
    });
    const err = await client.ravShiurim({ ravId: 674 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KolHalashonError);
    expect((err as Error).message).toContain('network request');
    expect((err as { cause?: Error }).cause?.message).toBe('ECONNRESET');
    client.close();
  });
});

describe('KolHalashonLockedError', () => {
  it('names the shiur it refers to', () => {
    const err = new KolHalashonLockedError(42740657);
    expect(err).toBeInstanceOf(KolHalashonError);
    expect(err.message).toBe('Shiur 42740657 is locked and requires a Kol Halashon subscription');
    expect(err.fileId).toBe(42740657);
  });
});
