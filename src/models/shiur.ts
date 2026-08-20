import { ShiurLanguage } from '../enums.js';
import { KolHalashonUrls, type KolHalashonUrlBases } from '../urls.js';
import { bool, compactStrings, isRecord, num, parseDurationSeconds, parseWireDate, str, type Wire } from './parse.js';

/**
 * A shiur as it appears in a list response. Field names are idiomatic camelCase; the
 * Pascal-cased wire shape never leaks out of the library.
 */
export interface Shiur {
  readonly fileId: number;
  /** `UserId` on the wire: the rav who gave the shiur. */
  readonly ravId: number | null;
  readonly ravNameHebrew: string | null;
  readonly ravNameEnglish: string | null;
  /** Pass to `KolHalashonUrls.ravImage`. */
  readonly ravImageFileName: string | null;

  /** Both titles are kept; the library never picks one for you. */
  readonly titleHebrew: string | null;
  readonly titleEnglish: string | null;

  readonly languageId: number | null;
  /** `languageId` narrowed to the known set, or `ShiurLanguage.ANY` when unrecognised. */
  readonly language: ShiurLanguage;

  readonly mainTopicHebrew: string | null;
  readonly mainTopicEnglish: string | null;
  readonly mainTagHebrew: string | null;
  readonly mainTagEnglish: string | null;

  /** The raw `"01:30:54"` string, unchanged. */
  readonly durationText: string | null;
  /** `durationText` in seconds, or `null` when absent or unparseable. Never 0 as a fallback. */
  readonly durationSeconds: number | null;
  /** `RecordDate` parsed as host local time; see `parseWireDate` for why. */
  readonly recordDate: Date | null;

  readonly folderId: number | null;
  readonly imageType: number | null;

  /** Hebrew category descriptions, empty entries dropped. */
  readonly categories: readonly string[];
  /** English category descriptions, empty entries dropped. */
  readonly categoriesEnglish: readonly string[];
  /** Raw category ids such as `"000604"`, in the same order as `categories`. */
  readonly categoryIds: readonly string[];

  readonly hasAudio: boolean;
  readonly hasVideo: boolean;
  readonly hasHdVideo: boolean;
  readonly isLocked: boolean;
  readonly downloadDisabled: boolean;
  readonly isWomenOnly: boolean;
  readonly downloadCount: number | null;

  /** Ready to hand to a media player. */
  readonly audioUrl: string;
  /** Video still. Meaningful only when `hasVideo`. */
  readonly thumbnailUrl: string;
  /** The human-facing page on kolhalashon.com. */
  readonly pageUrl: string;
}

function toLanguage(id: number | null): ShiurLanguage {
  const known = Object.values(ShiurLanguage) as number[];
  return known.includes(id ?? -1) ? ((id ?? -1) as ShiurLanguage) : ShiurLanguage.ANY;
}

/**
 * Parse one list item. Returns `null` instead of throwing when the item is unusable, so a
 * single malformed row cannot take down a whole page.
 */
export function parseShiur(raw: unknown, urls?: KolHalashonUrlBases): Shiur | null {
  if (!isRecord(raw)) return null;
  const w: Wire = raw;

  const fileId = num(w, 'FileId');
  if (fileId === null) return null; // Without an id there is nothing a caller could do with it.

  const languageId = num(w, 'LanguageId');
  const durationText = str(w, 'ShiurDuration');

  return {
    fileId,
    ravId: num(w, 'UserId'),
    ravNameHebrew: str(w, 'UserNameHebrew'),
    ravNameEnglish: str(w, 'UserNameEnglish'),
    ravImageFileName: str(w, 'RavImageFileName'),

    titleHebrew: str(w, 'TitleHebrew'),
    titleEnglish: str(w, 'TitleEnglish'),

    languageId,
    language: toLanguage(languageId),

    mainTopicHebrew: str(w, 'MainTopicHebrew'),
    mainTopicEnglish: str(w, 'MainTopicEnglish'),
    mainTagHebrew: str(w, 'MainTagHebrew'),
    mainTagEnglish: str(w, 'MainTagEnglish'),

    durationText,
    durationSeconds: parseDurationSeconds(durationText),
    recordDate: parseWireDate(str(w, 'RecordDate')),

    folderId: num(w, 'FolderId'),
    imageType: num(w, 'ImageType'),

    categories: compactStrings([str(w, 'CatDesc1'), str(w, 'CatDesc2')]),
    categoriesEnglish: compactStrings([str(w, 'CatDescEnglish1'), str(w, 'CatDescEnglish2')]),
    categoryIds: compactStrings([str(w, 'CatId1'), str(w, 'CatId2')]),

    hasAudio: bool(w, 'HasAudio'),
    hasVideo: bool(w, 'HasVideo'),
    hasHdVideo: bool(w, 'HasHdVideo'),
    isLocked: bool(w, 'IsLocked'),
    downloadDisabled: bool(w, 'DisableDownload'),
    isWomenOnly: bool(w, 'IsWomenOnly'),
    downloadCount: num(w, 'DownloadCount'),

    audioUrl: KolHalashonUrls.audio(fileId, urls),
    thumbnailUrl: KolHalashonUrls.thumbnail(fileId, urls),
    pageUrl: KolHalashonUrls.shiurPage(fileId, 'he', urls),
  };
}

/** Parse a whole array, skipping items that cannot be read. */
export function parseShiurim(raw: unknown, urls?: KolHalashonUrlBases): Shiur[] {
  if (!Array.isArray(raw)) return [];
  const out: Shiur[] = [];
  for (const item of raw) {
    const s = parseShiur(item, urls);
    if (s !== null) out.push(s);
  }
  return out;
}

/** One page of results, plus enough context for a caller to ask for the next one. */
export interface ShiurPage {
  readonly items: readonly Shiur[];
  /** The `fromRow` this page was requested with. */
  readonly fromRow: number;
  /** The `rowsPerPage` this page was requested with. */
  readonly rowsPerPage: number;
  /** `false` once the server returns fewer rows than requested. */
  readonly hasMore: boolean;
  /** Items the server sent that could not be parsed and were skipped. */
  readonly skipped: number;
}
