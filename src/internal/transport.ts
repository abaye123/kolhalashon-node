import {
  KolHalashonError,
  KolHalashonHttpError,
  KolHalashonNotFoundError,
  KolHalashonParseError,
  KolHalashonRateLimitedError,
  excerpt,
  looksLikeCloudflareChallenge,
} from '../errors.js';
import type { ResolvedOptions } from '../options.js';

/**
 * The site generates this per request with `Math.random().toString(36).slice(2, 9)` and the
 * server does not validate it in any way. It is NOT a credential and NOT a secret: there is
 * nothing here to leak. It exists because the site's HTTP interceptor sets it unconditionally,
 * and mirroring the site keeps the request shape unremarkable.
 */
export function generateSiteKey(): string {
  return Math.random().toString(36).slice(2, 9).padEnd(7, '0');
}

export interface RequestSpec {
  readonly method: 'GET' | 'POST';
  /** Path relative to `baseUrl`, already URL-encoded. */
  readonly path: string;
  readonly body?: unknown;
  /** Names the failing operation in error messages, e.g. `ravShiurim(rav 674)`. */
  readonly operation: string;
  /** External cancellation from the caller. */
  readonly signal?: AbortSignal;
}

const RETRYABLE_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

export class Transport {
  /**
   * One controller for the whole client, aborted by `close()`. Node's global fetch keeps a
   * process-wide keep-alive connection pool, so there is no per-client agent to dispose;
   * cancelling in-flight work is all `close()` can and should do.
   */
  readonly #lifetime = new AbortController();
  #closed = false;

  constructor(private readonly options: ResolvedOptions) {}

  get closed(): boolean {
    return this.#closed;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#lifetime.abort(new KolHalashonError('KolHalashonClient was closed'));
  }

  async json<T>(spec: RequestSpec): Promise<T> {
    const url = this.options.baseUrl + spec.path;
    const isIdempotent = spec.method === 'GET';
    const attempts = isIdempotent ? this.options.retries + 1 : 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 250ms, 500ms, 1000ms ...
        await this.#delay(250 * 2 ** (attempt - 1), spec.signal);
      }
      try {
        return await this.#once<T>(url, spec);
      } catch (err) {
        // Rate limiting and 4xx are not transient; retrying just deepens the hole.
        if (err instanceof KolHalashonRateLimitedError) throw err;
        if (err instanceof KolHalashonNotFoundError) throw err;
        // A body we cannot parse will not parse any better on the second try, and the API
        // is behind bot protection, so every wasted request has a cost.
        if (err instanceof KolHalashonParseError) throw err;
        if (err instanceof KolHalashonHttpError && !RETRYABLE_STATUSES.has(err.status)) throw err;
        if (this.#closed || spec.signal?.aborted) throw err;
        lastError = err;
      }
    }
    throw lastError;
  }

  async #once<T>(url: string, spec: RequestSpec): Promise<T> {
    if (this.#closed) {
      throw new KolHalashonError(`${spec.operation}: client is closed`);
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new KolHalashonError(`${spec.operation}: timed out after ${this.options.timeoutMillis}ms`));
    }, this.options.timeoutMillis);

    const signal = anySignal([timeoutController.signal, this.#lifetime.signal, spec.signal]);

    let response: Response;
    let text: string;
    try {
      response = await this.options.fetch(url, {
        method: spec.method,
        headers: this.#headers(),
        ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
        signal,
        // The API is public; sending cookies would only add fingerprinting surface.
        credentials: 'omit',
        redirect: 'follow',
      });
      // Read inside the timed region: a stalled body is as much a timeout as a stalled
      // connect, and the responses here are small enough that buffering costs nothing.
      text = await response.text();
    } catch (cause) {
      if (cause instanceof KolHalashonError) throw cause;
      if (signal.aborted) {
        throw new KolHalashonError(`${spec.operation}: cancelled`, { cause: signal.reason });
      }
      throw new KolHalashonError(`${spec.operation}: network request to ${url} failed`, { cause });
    } finally {
      clearTimeout(timer);
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (looksLikeCloudflareChallenge(response.status, contentType, text)) {
      throw new KolHalashonRateLimitedError(
        `${spec.operation}: blocked at ${url}`,
        response.status,
        url,
        excerpt(text),
      );
    }

    if (response.status === 404) {
      throw new KolHalashonNotFoundError(`${spec.operation}: not found at ${url}`, url);
    }

    if (!response.ok) {
      throw new KolHalashonHttpError(
        `${spec.operation}: HTTP ${response.status} from ${url}`,
        response.status,
        url,
        excerpt(text),
      );
    }

    if (text.trim() === '') {
      throw new KolHalashonNotFoundError(`${spec.operation}: empty response from ${url}`, url);
    }

    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new KolHalashonParseError(
        `${spec.operation}: response from ${url} is not valid JSON`,
        spec.operation,
        excerpt(text),
        { cause },
      );
    }
  }

  #headers(): Record<string, string> {
    return {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'authorization-site-key': `Bearer ${generateSiteKey()}`,
      origin: 'https://www.kolhalashon.com',
      referer: 'https://www.kolhalashon.com/',
      'user-agent': this.options.userAgent,
    };
  }

  #delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      const onAbort = () => {
        cleanup();
        reject(new KolHalashonError('request cancelled while backing off'));
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.#lifetime.signal.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.#lifetime.signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * `AbortSignal.any` is Node 20+; this keeps the stated Node 18 floor honest without a
 * polyfill dependency.
 */
function anySignal(signals: Array<AbortSignal | undefined>): AbortSignal {
  const live = signals.filter((s): s is AbortSignal => s !== undefined);
  const anyOf = (AbortSignal as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyOf === 'function') return anyOf(live);

  const controller = new AbortController();
  for (const s of live) {
    if (s.aborted) {
      controller.abort(s.reason);
      return controller.signal;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}
