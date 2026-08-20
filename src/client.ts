import type { ShiurLanguage } from './enums.js';
import { KolHalashonParseError, excerpt } from './errors.js';
import { mapWithConcurrency } from './internal/pool.js';
import { Transport } from './internal/transport.js';
import { parseRavFolders, type RavFolder } from './models/ravFolder.js';
import { isRecord, num } from './models/parse.js';
import { parseShiur, parseShiurim, type Shiur, type ShiurPage } from './models/shiur.js';
import { resolveOptions, type KolHalashonOptions, type ResolvedOptions } from './options.js';
import { DEFAULT_ROWS_PER_PAGE, buildShiurSearchBody, type ShiurQuery } from './query.js';
import type { KolHalashonUrlBases } from './urls.js';

export interface CallOptions {
  /** Cancels this call. Independent of `close()`, which cancels everything. */
  readonly signal?: AbortSignal;
}

export interface BulkOptions extends CallOptions {
  /** In-flight request cap. Defaults to the client's `concurrency` option (4). */
  readonly concurrency?: number;
}

/**
 * Client for the Kol Halashon read API.
 *
 * One instance per application. The instance owns the request lifetime; construct it once
 * and reuse it so the runtime's keep-alive pool stays warm across calls.
 */
export class KolHalashonClient {
  readonly #options: ResolvedOptions;
  readonly #transport: Transport;
  readonly #urlBases: KolHalashonUrlBases;

  constructor(options: KolHalashonOptions = {}) {
    this.#options = resolveOptions(options);
    this.#transport = new Transport(this.#options);
    this.#urlBases = {
      baseUrl: this.#options.baseUrl,
      mediaBaseUrl: this.#options.mediaBaseUrl,
      siteBaseUrl: this.#options.siteBaseUrl,
    };
  }

  /** One page of a rav's shiurim. */
  async ravShiurim(query: ShiurQuery, call: CallOptions = {}): Promise<ShiurPage> {
    const fromRow = query.fromRow ?? 0;
    const rowsPerPage = query.rowsPerPage ?? DEFAULT_ROWS_PER_PAGE;

    const raw = await this.#transport.json<unknown>({
      method: 'POST',
      path: 'Search/WebSite_GetRavShiurim/',
      body: buildShiurSearchBody({ language: this.#options.language, ...query }),
      operation: `ravShiurim(rav ${query.ravId}, fromRow ${fromRow})`,
      ...(call.signal ? { signal: call.signal } : {}),
    });

    if (!Array.isArray(raw)) {
      throw new KolHalashonParseError(
        `ravShiurim(rav ${query.ravId}): expected a JSON array of shiurim`,
        'WebSite_GetRavShiurim response',
        excerpt(JSON.stringify(raw) ?? String(raw)),
      );
    }

    const items = parseShiurim(raw, this.#urlBases);
    return {
      items,
      fromRow,
      rowsPerPage,
      hasMore: raw.length >= rowsPerPage,
      skipped: raw.length - items.length,
    };
  }

  /** How many shiurim a rav has, optionally narrowed to one language. */
  async ravShiurimCount(
    ravId: number,
    language: ShiurLanguage | number = this.#options.language,
    call: CallOptions = {},
  ): Promise<number> {
    const raw = await this.#transport.json<unknown>({
      method: 'GET',
      path: `Ravs/WebSite_GetRavShiurimCount/${encodeURIComponent(ravId)}/${encodeURIComponent(language)}`,
      operation: `ravShiurimCount(rav ${ravId})`,
      ...(call.signal ? { signal: call.signal } : {}),
    });

    // The endpoint answers with a generic scalar envelope; the count lives in VarInt.
    const value = isRecord(raw) ? num(raw, 'VarInt') : null;
    if (value === null) {
      throw new KolHalashonParseError(
        `ravShiurimCount(rav ${ravId}): response has no numeric VarInt`,
        'WebSite_GetRavShiurimCount response',
        excerpt(JSON.stringify(raw) ?? String(raw)),
      );
    }
    return value;
  }

  /**
   * Every shiur of a rav, as a lazy stream.
   *
   * Nothing is fetched until the consumer pulls, pages advance by `rowsPerPage`, and the
   * stream ends when the server returns a short page. Breaking out of the `for await` loop,
   * or aborting `call.signal`, stops the walk; the full result set is never buffered.
   */
  async *allRavShiurim(query: ShiurQuery, call: CallOptions = {}): AsyncGenerator<Shiur, void, undefined> {
    const rowsPerPage = query.rowsPerPage ?? DEFAULT_ROWS_PER_PAGE;
    let fromRow = query.fromRow ?? 0;

    for (;;) {
      const page = await this.ravShiurim({ ...query, fromRow, rowsPerPage }, call);
      for (const shiur of page.items) {
        yield shiur;
      }
      if (!page.hasMore) return;
      fromRow += rowsPerPage;
    }
  }

  /**
   * A known number of rows, fetched with a bounded number of requests in flight.
   *
   * Use this when you already know how many rows you want (typically from
   * {@link ravShiurimCount}) and want them faster than a sequential walk. The default cap
   * is 4; raising it is how you get rate limited.
   */
  async ravShiurimBulk(query: ShiurQuery, totalRows: number, call: BulkOptions = {}): Promise<Shiur[]> {
    if (!Number.isInteger(totalRows) || totalRows < 0) {
      throw new TypeError(`totalRows must be a non-negative integer, got ${String(totalRows)}`);
    }
    const rowsPerPage = query.rowsPerPage ?? DEFAULT_ROWS_PER_PAGE;
    const start = query.fromRow ?? 0;
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const offsets = Array.from({ length: pageCount }, (_, i) => start + i * rowsPerPage);

    const pages = await mapWithConcurrency(
      offsets,
      call.concurrency ?? this.#options.concurrency,
      (fromRow) => this.ravShiurim({ ...query, fromRow, rowsPerPage }, call),
    );

    return pages.flatMap((p) => p.items as Shiur[]).slice(0, totalRows);
  }

  /** Top-level category folders on a rav's page. */
  async ravFolders(
    ravId: number,
    language: ShiurLanguage | number = this.#options.language,
    call: CallOptions = {},
  ): Promise<RavFolder[]> {
    const raw = await this.#transport.json<unknown>({
      method: 'GET',
      path: `Ravs/GetRavMainFolders/${encodeURIComponent(ravId)}/${encodeURIComponent(language)}`,
      operation: `ravFolders(rav ${ravId})`,
      ...(call.signal ? { signal: call.signal } : {}),
    });

    if (!Array.isArray(raw)) {
      throw new KolHalashonParseError(
        `ravFolders(rav ${ravId}): expected a JSON array of folders`,
        'GetRavMainFolders response',
        excerpt(JSON.stringify(raw) ?? String(raw)),
      );
    }
    return parseRavFolders(raw);
  }

  /**
   * The single newest shiur of a rav. A one-request convenience over {@link ravShiurim};
   * returns `null` when the rav has none.
   */
  async newestShiur(ravId: number, call: CallOptions = {}): Promise<Shiur | null> {
    const page = await this.ravShiurim({ ravId, fromRow: 0, rowsPerPage: 1 }, call);
    return page.items[0] ?? null;
  }

  /** Parse a single wire item with this client's URL bases. Useful for cached payloads. */
  parseShiur(raw: unknown): Shiur | null {
    return parseShiur(raw, this.#urlBases);
  }

  /** Cancel everything in flight. The instance is unusable afterwards. */
  close(): void {
    this.#transport.close();
  }
}
