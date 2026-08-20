export { KolHalashonClient, type BulkOptions, type CallOptions } from './client.js';
export {
  DEFAULT_USER_AGENT,
  resolveOptions,
  type FetchLike,
  type KolHalashonOptions,
  type ResolvedOptions,
} from './options.js';

export { MediaQuality, SearchOrder, ShiurLanguage, shiurLanguageName } from './enums.js';

export {
  DEFAULT_ROWS_PER_PAGE,
  FILTER_SWITCH_ALL,
  buildShiurSearchBody,
  type ShiurQuery,
} from './query.js';

export {
  DEFAULT_BASE_URL,
  DEFAULT_MEDIA_BASE_URL,
  DEFAULT_SITE_BASE_URL,
  KolHalashonUrls,
  ravImageFileName,
  shiurFileName,
  shiurFolderName,
  type KolHalashonUrlBases,
} from './urls.js';

export { parseShiur, parseShiurim, type Shiur, type ShiurPage } from './models/shiur.js';
export { parseRavFolder, parseRavFolders, type RavFolder } from './models/ravFolder.js';
export { ravFromShiur, type Rav } from './models/rav.js';
export { parseDurationSeconds, parseWireDate } from './models/parse.js';

export {
  KolHalashonError,
  KolHalashonHttpError,
  KolHalashonLockedError,
  KolHalashonNotFoundError,
  KolHalashonParseError,
  KolHalashonRateLimitedError,
} from './errors.js';
