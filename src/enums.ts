/**
 * Content language of a shiur. Ids are the site's `LanguageId` values, taken from the
 * language picker in the web bundle. `ANY` is the wire sentinel for "do not filter".
 */
export const ShiurLanguage = {
  ANY: -1,
  HEBREW: 1,
  ENGLISH: 2,
  YIDDISH: 3,
  FRENCH: 4,
  SPANISH: 5,
  RUSSIAN: 6,
  BUKHARI: 7,
  HUNGARIAN: 8,
  PORTUGUESE: 9,
  PERSIAN: 10,
  DUTCH: 11,
  POLISH: 12,
  GERMAN: 13,
  GEORGIAN: 14,
} as const;

export type ShiurLanguage = (typeof ShiurLanguage)[keyof typeof ShiurLanguage];

/** Human-readable English name for a language id, or `null` for an id we do not know. */
export function shiurLanguageName(id: number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  const hit = Object.entries(ShiurLanguage).find(([, v]) => v === id);
  return hit ? hit[0] : null;
}

/**
 * Sort order for `WebSite_GetRavShiurim`.
 *
 * Only `NEWEST_FIRST` (7) has been observed against the live API. The site sends other
 * integers here, but their meaning was not confirmed, so they are deliberately not named:
 * pass a raw number on `ShiurQuery.order` if you want to experiment.
 */
export const SearchOrder = {
  /** The site's default for a rav page: most recent recording date first. */
  NEWEST_FIRST: 7,
  /** The wire sentinel for "server default"; what that resolves to is unspecified. */
  SERVER_DEFAULT: -1,
} as const;

export type SearchOrder = (typeof SearchOrder)[keyof typeof SearchOrder];

/**
 * Media quality a caller might ask for.
 *
 * Only `AUDIO` is backed by a verified endpoint (`files/GetMp3FileToPlay/{fileId}`).
 * The video variants are declared so the twin libraries agree on the vocabulary, but no
 * URL builder returns one until the video endpoints are confirmed.
 */
export const MediaQuality = {
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  VIDEO_HD: 'VIDEO_HD',
} as const;

export type MediaQuality = (typeof MediaQuality)[keyof typeof MediaQuality];
