import { SearchOrder, ShiurLanguage } from './enums.js';

/**
 * What a caller plausibly wants to set when listing a rav's shiurim.
 *
 * The wire body has ~18 fields; all the rest are "no filter" sentinels filled in by
 * {@link buildShiurSearchBody}.
 *
 * `FiltersArray` (category filtering) is intentionally absent: its element shape was never
 * confirmed against the live API, and a field that silently does nothing is worse than a
 * missing one.
 */
export interface ShiurQuery {
  /** Rav id. Maps to `GeneralID` on the wire. */
  readonly ravId: number;
  /** Zero-based offset of the first row. Default 0. */
  readonly fromRow?: number;
  /** Rows per request. The site uses 24. Default 24. */
  readonly rowsPerPage?: number;
  /** Sort order. Default {@link SearchOrder.NEWEST_FIRST}. */
  readonly order?: SearchOrder | number;
  /** Content language filter. Default {@link ShiurLanguage.ANY}. */
  readonly language?: ShiurLanguage | number;
}

export const DEFAULT_ROWS_PER_PAGE = 24;

/**
 * The site's "no filter" sentinels, in one place.
 *
 * Every one of these is a filter dimension on the shared server-side search procedure
 * (masechet, daf, moed, parasha, and the Oz Vehadar variants). `-1` means "do not
 * constrain". `FilterSwitch` is a 111-character bit string, one flag per filterable
 * column; the site sends all `1`s for an unfiltered search and the server accepts it.
 * Do not shorten it: the length is what the stored procedure indexes against.
 */
const NO_FILTER_SENTINELS = {
  QueryType: -1,
  LangID: -1,
  MasechetID: -1,
  DafNo: -1,
  MasechetIDY: -1,
  DafNoY: -1,
  MoedID: -1,
  ParashaID: -1,
  EnglishDisplay: false,
  MasechetIDYOz: -1,
  DafNoYOz: -1,
  FiltersArray: [] as readonly unknown[],
} as const;

export const FILTER_SWITCH_ALL = '1'.repeat(111);

/** The exact JSON body `Search/WebSite_GetRavShiurim/` expects. */
export function buildShiurSearchBody(query: ShiurQuery): Record<string, unknown> {
  if (!Number.isInteger(query.ravId)) {
    throw new TypeError(`ShiurQuery.ravId must be an integer, got ${String(query.ravId)}`);
  }
  const fromRow = query.fromRow ?? 0;
  const rowsPerPage = query.rowsPerPage ?? DEFAULT_ROWS_PER_PAGE;
  if (!Number.isInteger(fromRow) || fromRow < 0) {
    throw new TypeError(`ShiurQuery.fromRow must be a non-negative integer, got ${String(fromRow)}`);
  }
  if (!Number.isInteger(rowsPerPage) || rowsPerPage < 1) {
    throw new TypeError(`ShiurQuery.rowsPerPage must be a positive integer, got ${String(rowsPerPage)}`);
  }

  return {
    ...NO_FILTER_SENTINELS,
    FromRow: fromRow,
    NumOfRows: rowsPerPage,
    PrefferedLanguage: query.language ?? ShiurLanguage.ANY, // sic: the API misspells it
    SearchOrder: query.order ?? SearchOrder.NEWEST_FIRST,
    GeneralID: query.ravId,
    FilterSwitch: FILTER_SWITCH_ALL,
  };
}
