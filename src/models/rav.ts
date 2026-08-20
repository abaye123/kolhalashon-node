import { KolHalashonUrls, type KolHalashonUrlBases } from '../urls.js';
import type { Shiur } from './shiur.js';

/**
 * Identity of a rav.
 *
 * There is no verified endpoint that returns a rav profile on its own (see the README's
 * "not implemented" list), so the only supported way to obtain one today is to lift it off
 * a shiur that the rav gave.
 */
export interface Rav {
  readonly ravId: number;
  readonly nameHebrew: string | null;
  readonly nameEnglish: string | null;
  readonly imageFileName: string | null;
  readonly imageUrl: string;
}

/** Project the rav identity carried on every list item. */
export function ravFromShiur(shiur: Shiur, urls?: KolHalashonUrlBases): Rav | null {
  if (shiur.ravId === null) return null;
  return {
    ravId: shiur.ravId,
    nameHebrew: shiur.ravNameHebrew,
    nameEnglish: shiur.ravNameEnglish,
    imageFileName: shiur.ravImageFileName,
    imageUrl:
      shiur.ravImageFileName !== null
        ? KolHalashonUrls.ravImage(shiur.ravImageFileName, urls)
        : KolHalashonUrls.ravImageForRavId(shiur.ravId, urls),
  };
}
