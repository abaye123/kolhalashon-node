import { ShiurLanguage } from './enums.js';
import { DEFAULT_BASE_URL, DEFAULT_MEDIA_BASE_URL, DEFAULT_SITE_BASE_URL } from './urls.js';

/**
 * Minimal structural type for `fetch`, so the library depends on the global rather than on
 * `undici` or DOM types at runtime. Injecting your own implementation is the main
 * testability hook: the offline test suite drives the whole client through a stub.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface KolHalashonOptions {
  /** JSON API root. Default `https://srv.kolhalashon.com/api/`. */
  readonly baseUrl?: string;
  /** Static media root, used by the URL builders. Default `https://www.kolhalashon.com/`. */
  readonly mediaBaseUrl?: string;
  /** Website root, used for `pageUrl`. Default `https://www.kolhalashon.com/`. */
  readonly siteBaseUrl?: string;
  /** Some endpoints answer 403 without a desktop browser User-Agent. */
  readonly userAgent?: string;
  /** Default language for calls that take one. Default {@link ShiurLanguage.ANY}. */
  readonly language?: ShiurLanguage | number;
  /** Per-request timeout. Default 30000. */
  readonly timeoutMillis?: number;
  /** Retries for idempotent requests, with exponential backoff. Default 2. */
  readonly retries?: number;
  /** Default in-flight request cap for the bulk path. Default 4. Keep it low. */
  readonly concurrency?: number;
  /** Injected `fetch`. Defaults to `globalThis.fetch`. */
  readonly fetch?: FetchLike;
}

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface ResolvedOptions {
  readonly baseUrl: string;
  readonly mediaBaseUrl: string;
  readonly siteBaseUrl: string;
  readonly userAgent: string;
  readonly language: number;
  readonly timeoutMillis: number;
  readonly retries: number;
  readonly concurrency: number;
  readonly fetch: FetchLike;
}

function withSlash(u: string): string {
  return u.endsWith('/') ? u : `${u}/`;
}

export function resolveOptions(options: KolHalashonOptions = {}): ResolvedOptions {
  const f = options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (typeof f !== 'function') {
    throw new TypeError(
      'No fetch implementation available. Use Node 18+, or pass `fetch` in KolHalashonOptions.',
    );
  }
  return {
    baseUrl: withSlash(options.baseUrl ?? DEFAULT_BASE_URL),
    mediaBaseUrl: withSlash(options.mediaBaseUrl ?? DEFAULT_MEDIA_BASE_URL),
    siteBaseUrl: withSlash(options.siteBaseUrl ?? DEFAULT_SITE_BASE_URL),
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    language: options.language ?? ShiurLanguage.ANY,
    timeoutMillis: options.timeoutMillis ?? 30_000,
    retries: Math.max(0, options.retries ?? 2),
    concurrency: Math.max(1, options.concurrency ?? 4),
    fetch: f,
  };
}
