import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FetchLike } from '../src/index.js';

/** Fixtures are read with an explicit utf8 decode so Hebrew survives on Windows. */
export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

export function fixtureJson<T>(name: string): T {
  return JSON.parse(fixture(name)) as T;
}

export interface StubCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface StubResponse {
  status?: number;
  contentType?: string;
  body?: string;
}

export interface Stub {
  fetch: FetchLike;
  calls: StubCall[];
}

/**
 * Deterministic `fetch` replacement. `handler` gets the call and returns what to answer with.
 * Nothing here touches the network, so the offline suite runs in CI with no egress at all.
 */
export function stubFetch(handler: (call: StubCall, index: number) => StubResponse): Stub {
  const calls: StubCall[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    // Checked first so an aborted attempt is never recorded as a call, matching a real
    // fetch that rejects before anything leaves the process.
    init.signal?.throwIfAborted();
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>),
    );
    const rawBody = init.body;
    const call: StubCall = {
      url: input,
      method: init.method ?? 'GET',
      headers,
      body: typeof rawBody === 'string' ? JSON.parse(rawBody) : undefined,
    };
    calls.push(call);

    const r = handler(call, calls.length - 1);
    return new Response(r.body ?? '', {
      status: r.status ?? 200,
      headers: { 'content-type': r.contentType ?? 'application/json; charset=utf-8' },
    });
  };
  return { fetch: fetchImpl, calls };
}

/** Build a JSON array page of `count` synthetic shiurim starting at `startId`. */
export function fakePage(count: number, startId = 40000000): string {
  return JSON.stringify(
    Array.from({ length: count }, (_, i) => ({
      FileId: startId + i,
      UserId: 674,
      UserNameHebrew: 'הרב אלימלך בידרמן',
      ShiurDuration: '00:10:00',
      RecordDate: '2026-01-02T03:04:05',
      HasAudio: true,
    })),
  );
}
