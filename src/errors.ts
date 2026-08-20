/**
 * Error taxonomy. Every failure the library reports is an instance of
 * {@link KolHalashonError}; a raw `fetch` rejection or a bare string never escapes.
 */
export class KolHalashonError extends Error {
  override readonly name: string = 'KolHalashonError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      // `cause` in the ErrorOptions constructor is Node 16.9+; assign directly so the
      // library keeps working on older bundler targets that strip the second argument.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** A non-2xx HTTP response that is not one of the more specific cases below. */
export class KolHalashonHttpError extends KolHalashonError {
  override readonly name = 'KolHalashonHttpError';

  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly bodyExcerpt: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * Cloudflare bot protection rejected the request.
 *
 * The tell is HTTP 403 whose body is the interstitial HTML page rather than JSON.
 * This is throttling, not an authentication problem: no credential exists that would
 * make it go away. Back off for a while and retry with fewer, slower requests.
 */
export class KolHalashonRateLimitedError extends KolHalashonError {
  override readonly name = 'KolHalashonRateLimitedError';

  /** Advice for the caller, in seconds. Nothing in the response carries a real Retry-After. */
  readonly suggestedBackoffSeconds: number;

  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly bodyExcerpt: string,
    suggestedBackoffSeconds = 60,
  ) {
    super(
      `${message} - Cloudflare bot protection is throttling this client. ` +
        `This is not an auth failure; back off for at least ${suggestedBackoffSeconds}s ` +
        `and reduce request concurrency.`,
    );
    this.suggestedBackoffSeconds = suggestedBackoffSeconds;
  }
}

/** The body could not be understood: not JSON, or not the shape the operation needs. */
export class KolHalashonParseError extends KolHalashonError {
  override readonly name = 'KolHalashonParseError';

  constructor(
    message: string,
    readonly what: string,
    readonly rawExcerpt: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** HTTP 404, or a 200 whose payload is empty where the operation requires an entity. */
export class KolHalashonNotFoundError extends KolHalashonError {
  override readonly name = 'KolHalashonNotFoundError';

  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
  }
}

/** The shiur is behind a subscription (`IsLocked` on the wire). */
export class KolHalashonLockedError extends KolHalashonError {
  override readonly name = 'KolHalashonLockedError';

  constructor(readonly fileId: number) {
    super(`Shiur ${fileId} is locked and requires a Kol Halashon subscription`);
  }
}

/** Trim a body for inclusion in an error message without dumping a whole HTML page. */
export function excerpt(body: string, max = 300): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}...`;
}

/**
 * Cloudflare's interstitial is served as HTML with a `Just a moment...` title.
 * A genuine API 403 would still be JSON, so the content sniff is what separates them.
 */
export function looksLikeCloudflareChallenge(status: number, contentType: string, body: string): boolean {
  if (status !== 403 && status !== 503 && status !== 429) return false;
  if (contentType.includes('application/json')) return false;
  return (
    body.includes('Just a moment...') ||
    body.includes('cf-browser-verification') ||
    body.includes('/cdn-cgi/challenge-platform/')
  );
}
