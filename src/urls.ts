/**
 * Pure URL builders. No network, no client instance, no I/O.
 *
 * These are the highest-value part of the library for a media player: the audio URL is
 * handed straight to the player element, so building it must never require a request.
 */

/** The JSON API. Verified working; `www.kolhalashon.com/api/` is the same app behind the CDN. */
export const DEFAULT_BASE_URL = 'https://srv.kolhalashon.com/api/';

/** Static media host, from the site's own runtime config (`baseUrl`). */
export const DEFAULT_MEDIA_BASE_URL = 'https://www.kolhalashon.com/';

/** The human-facing Angular site (`clientBaseUrl` in the same config). */
export const DEFAULT_SITE_BASE_URL = 'https://www.kolhalashon.com/';

/**
 * The site pads every file id to 8 characters (`fileNameLengthFormat = 8`) and buckets
 * files into folders named by the first 5 characters of that padded id.
 */
const FILE_NAME_LENGTH = 8;

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function requireFileId(fileId: number): number {
  if (!Number.isInteger(fileId) || fileId < 0) {
    throw new TypeError(`fileId must be a non-negative integer, got ${String(fileId)}`);
  }
  return fileId;
}

/** `getShiurNameFromID` from the site bundle: the id zero-padded to 8 characters. */
export function shiurFileName(fileId: number): string {
  return String(requireFileId(fileId)).padStart(FILE_NAME_LENGTH, '0');
}

/** `getShiurFolderName` from the site bundle: the first 5 characters of {@link shiurFileName}. */
export function shiurFolderName(fileId: number): string {
  return shiurFileName(fileId).slice(0, 5);
}

/**
 * `convertIdToLength4Or6` from the site bundle: rav image file names are the rav id
 * padded to 4 digits, or to 6 once the id exceeds 9999.
 */
export function ravImageFileName(ravId: number): string {
  const s = String(ravId);
  return ravId > 9999 ? s.padStart(6, '0') : s.padStart(4, '0');
}

export interface KolHalashonUrlBases {
  /** JSON API root, must end with a slash. Default {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Static media root. Default {@link DEFAULT_MEDIA_BASE_URL}. */
  mediaBaseUrl?: string;
  /** Website root, for human-facing page links. Default {@link DEFAULT_SITE_BASE_URL}. */
  siteBaseUrl?: string;
}

function bases(o?: KolHalashonUrlBases) {
  return {
    api: ensureTrailingSlash(o?.baseUrl ?? DEFAULT_BASE_URL),
    media: ensureTrailingSlash(o?.mediaBaseUrl ?? DEFAULT_MEDIA_BASE_URL),
    site: ensureTrailingSlash(o?.siteBaseUrl ?? DEFAULT_SITE_BASE_URL),
  };
}

export const KolHalashonUrls = {
  /**
   * Streamable MP3 for a shiur. The response is `audio/mp3` with `Accept-Ranges: bytes`,
   * so a player can seek. The library never fetches this itself.
   *
   * Browsers other than the site's own origin are blocked: the response carries
   * `access-control-allow-origin: https://www.kolhalashon.com`. A `<audio src>` tag is a
   * no-CORS media load and usually still plays; `fetch`/XHR from a browser will not.
   */
  audio(fileId: number, o?: KolHalashonUrlBases): string {
    return `${bases(o).api}files/GetMp3FileToPlay/${requireFileId(fileId)}`;
  },

  /**
   * Portrait of a rav. Takes the `RavImageFileName` straight off a {@link Shiur}
   * (for example `"0674.jpg"`); use {@link ravImageUrlForRavId} if you only have the id.
   */
  ravImage(imageFileName: string, o?: KolHalashonUrlBases): string {
    return `${bases(o).media}imgs/Ravs/${imageFileName}`;
  },

  /** Portrait of a rav derived from the rav id alone. */
  ravImageForRavId(ravId: number, o?: KolHalashonUrlBases): string {
    return `${bases(o).media}imgs/Ravs/${ravImageFileName(ravId)}.jpg`;
  },

  /** Video still for a shiur. Present only for shiurim that have video. */
  thumbnail(fileId: number, o?: KolHalashonUrlBases): string {
    const { media } = bases(o);
    return `${media}imgs/VideoThumbNails/${shiurFolderName(fileId)}/${shiurFileName(fileId)}.jpg`;
  },

  /** Animated hover preview for a shiur, the `.webp` sibling of {@link thumbnail}. */
  thumbnailPreview(fileId: number, o?: KolHalashonUrlBases): string {
    const { media } = bases(o);
    return `${media}imgs/VideoThumbNails/${shiurFolderName(fileId)}/${shiurFileName(fileId)}.webp`;
  },

  /** The human-facing player page on kolhalashon.com. `lang` is the site UI language. */
  shiurPage(fileId: number, lang: 'he' | 'en' = 'he', o?: KolHalashonUrlBases): string {
    return `${bases(o).site}${lang}/regularSite/playShiur/${requireFileId(fileId)}`;
  },
} as const;

/** Alias kept for symmetry with {@link KolHalashonUrls.ravImageForRavId}. */
export const ravImageUrlForRavId = KolHalashonUrls.ravImageForRavId;
