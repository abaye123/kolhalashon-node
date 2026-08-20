# kolhalashon-api

A small, zero-dependency TypeScript client for the [Kol Halashon](https://www.kolhalashon.com)
(קול הלשון) read API. Ships ESM and CommonJS with type declarations.

Not affiliated with, endorsed by, or supported by Kol Halashon. The library only reads
publicly reachable endpoints, it honours `IsLocked`, and it never downloads audio for you.

```
npm install kolhalashon-api
```

Requires Node 18 or newer (it uses the global `fetch`). No runtime dependencies.

## Quickstart

Print and play the newest shiur of rav 674, הרב אלימלך בידרמן:

```ts
import { KolHalashonClient } from 'kolhalashon-api';

const client = new KolHalashonClient();
const shiur = await client.newestShiur(674);

console.log(shiur?.titleHebrew);           // פרשת כי תצא - זמן תשובה ...
console.log(shiur?.durationSeconds);       // 5454
console.log(shiur?.recordDate);            // 2026-08-18T21:37:19 (local time)
console.log(shiur?.audioUrl);              // hand this straight to a player

client.close();
```

A runnable version is in [`examples/newest-shiur.mjs`](examples/newest-shiur.mjs).

## API surface

### `new KolHalashonClient(options?)`

One instance per application. It owns the request lifetime, so construct it once and reuse
it rather than making one per call; that is what keeps the runtime's keep-alive connection
pool warm.

| Method | Returns | Notes |
|---|---|---|
| `ravShiurim(query, call?)` | `Promise<ShiurPage>` | One page of a rav's shiurim. |
| `ravShiurimCount(ravId, language?, call?)` | `Promise<number>` | Total for a rav, optionally per language. |
| `allRavShiurim(query, call?)` | `AsyncGenerator<Shiur>` | Lazy walk over every page. |
| `ravShiurimBulk(query, totalRows, call?)` | `Promise<Shiur[]>` | A known total, bounded concurrency. |
| `ravFolders(ravId, language?, call?)` | `Promise<RavFolder[]>` | A rav's top-level categories. |
| `newestShiur(ravId, call?)` | `Promise<Shiur \| null>` | Convenience over `ravShiurim`. |
| `parseShiur(raw)` | `Shiur \| null` | Parse a cached wire payload with this client's URL bases. |
| `close()` | `void` | Cancels everything in flight. The instance is unusable afterwards. |

Every method takes an optional final argument carrying an `AbortSignal` for per-call
cancellation, independent of `close()`.

### `KolHalashonOptions`

| Option | Default | |
|---|---|---|
| `baseUrl` | `https://srv.kolhalashon.com/api/` | JSON API root. |
| `mediaBaseUrl` | `https://www.kolhalashon.com/` | Images and thumbnails. |
| `siteBaseUrl` | `https://www.kolhalashon.com/` | Human-facing page links. |
| `userAgent` | a desktop Chrome UA | Some endpoints answer 403 without one. |
| `language` | `ShiurLanguage.ANY` | Default for calls that take a language. |
| `timeoutMillis` | `30000` | Per request. |
| `retries` | `2` | Idempotent GETs only, exponential backoff. |
| `concurrency` | `4` | In-flight cap for `ravShiurimBulk`. Raising it gets you rate limited. |
| `fetch` | `globalThis.fetch` | Inject your own. This is the main testability hook. |

### `ShiurQuery`

```ts
{
  ravId: number;         // required, maps to GeneralID
  fromRow?: number;      // default 0
  rowsPerPage?: number;  // default 24, the site's own page size
  order?: SearchOrder;   // default SearchOrder.NEWEST_FIRST
  language?: ShiurLanguage;
}
```

The wire body has about eighteen more fields, all of them "no filter" sentinels. They live
in one commented constant in `src/query.ts` and are not your problem. Category filtering
(`FiltersArray`) is deliberately not exposed: the element shape was never confirmed, and a
field that silently does nothing is worse than a missing one.

### Streaming pagination

`allRavShiurim` is lazy: no request is made until you pull, pages advance by `rowsPerPage`,
and the walk stops when the server returns a short page. Breaking out of the loop stops it,
and the full result set is never buffered. Rav 674 has 5852 shiurim; this streams them.

```ts
for await (const shiur of client.allRavShiurim({ ravId: 674 })) {
  if (shiur.hasVideo) console.log(shiur.titleHebrew);
  if (someCondition) break;   // no further pages are fetched
}
```

When you already know how many rows you want, `ravShiurimBulk` fetches them with at most
`concurrency` requests in flight and returns them in order.

### `KolHalashonUrls` - pure, no client needed

```ts
import { KolHalashonUrls } from 'kolhalashon-api';

KolHalashonUrls.audio(42740657);
// https://srv.kolhalashon.com/api/files/GetMp3FileToPlay/42740657

KolHalashonUrls.thumbnail(42740657);
// https://www.kolhalashon.com/imgs/VideoThumbNails/42740/42740657.jpg

KolHalashonUrls.ravImage('0674.jpg');
// https://www.kolhalashon.com/imgs/Ravs/0674.jpg

KolHalashonUrls.shiurPage(42740657, 'he');
// https://www.kolhalashon.com/he/regularSite/playShiur/42740657
```

These are plain functions. No network, no I/O, no client instance. The file-name algorithm
(`fileId` zero-padded to 8 characters, bucketed by the leading 5) is transcribed from the
site's own bundle and exported as `shiurFileName` / `shiurFolderName` / `ravImageFileName`.

The audio response is `audio/mp3` with `Accept-Ranges: bytes`, so a player can seek. **The
library never fetches it.** If you need to save a file, stream the URL to a sink yourself.

## Dates and durations

`RecordDate` arrives as `"2026-08-18T21:37:19"` with **no timezone offset**. `new Date(...)`
would apply the ES rule that an offset-less date-time is UTC, silently shifting every
timestamp. This library parses the components explicitly and builds a **host local time**
`Date`, which matches how the site renders them. If you need Israel time specifically,
convert from the components yourself.

`ShiurDuration` is kept verbatim as `durationText` and additionally exposed as
`durationSeconds`. An absent or unparseable duration is `null`, never `0`: a caller cannot
tell a real zero from a parse failure.

## Errors

Every failure is a `KolHalashonError`. A raw fetch rejection never escapes.

| Class | When |
|---|---|
| `KolHalashonRateLimitedError` | Cloudflare bot protection. See below. |
| `KolHalashonHttpError` | Any other non-2xx. Carries `status`, `url`, `bodyExcerpt`. |
| `KolHalashonNotFoundError` | 404, or a 200 with an empty body. |
| `KolHalashonParseError` | Not JSON, or not the shape the operation needs. |
| `KolHalashonLockedError` | The shiur needs a subscription. |

Messages name the operation and the id: `"Shiur 42740657 is locked"`, not `"request failed"`.

### Rate limiting is not an auth failure

The API sits behind Cloudflare. A burst of requests trips bot protection, after which the
API answers **HTTP 403 with an HTML body whose title is `Just a moment...`** instead of JSON.
There is no credential that fixes this; the only fix is fewer, slower requests.

The library sniffs that response and raises `KolHalashonRateLimitedError` rather than a
generic 403, and does not retry it:

```ts
import { KolHalashonRateLimitedError } from 'kolhalashon-api';

try {
  await client.ravShiurim({ ravId: 674 });
} catch (err) {
  if (err instanceof KolHalashonRateLimitedError) {
    console.error(`backing off for ${err.suggestedBackoffSeconds}s`);
  }
}
```

Keep `concurrency` at its default, do not put the client in a tight loop, and cache results.

## The `authorization-site-key` header

Every request carries `authorization-site-key: Bearer <7 random base36 chars>`, because the
website's own HTTP interceptor sets it unconditionally. The site generates it with
`Math.random().toString(36).slice(2, 9)` and **the server does not validate it**. It is not
a credential, not a secret, and there is nothing here to leak. It is generated fresh per
request, exactly as the site does.

## Browser use is blocked by CORS

The API replies with `access-control-allow-origin: https://www.kolhalashon.com`. Any browser
on a different origin will have its `fetch`/XHR blocked, so **this package cannot call the
API directly from a web page.** Use it from Node, or put a small same-origin proxy in front
and point `baseUrl` at it:

```ts
new KolHalashonClient({ baseUrl: 'https://your-app.example/kolhalashon/' });
```

The URL builders are pure string functions and work fine in a browser regardless. A plain
`<audio src={shiur.audioUrl}>` is a no-CORS media load and usually still plays; anything
that reads the bytes will not.

Nothing in the main entry path imports from `node:*`, so the package bundles cleanly for the
browser once the proxy is in place.

## Not implemented

These endpoints exist in the site's bundle but were never observed returning 200 from this
machine (Cloudflare answered 403 for every verification attempt), so they are deliberately
absent from the public surface rather than shipped on a guess:

| Endpoint | Would have been |
|---|---|
| `TblShiurimLists/WebSite_GetShiurDetails/{fileId}` | `shiurDetails(fileId)` |
| `Search/WebSite_GetSearchItems/{keyword}/{userId}/{n}/{n}` | `search(keyword)` |
| `Ravs/GetRavGenaralInfo/{ravId}` | `rav(ravId)` |
| `Ravs/GetRavsNames` | a rav directory |
| `Ravs/GetRavBasicProp/{ravId}/{isEnglish}` | rav display properties. Note the second segment is a **boolean**, not a language code; `he` returns HTTP 400 |
| `Ravs/GetRavCatListDesc/{...}` | category descriptions |

`Rav` still exists as a type: `ravFromShiur(shiur)` projects the rav identity that every
list item already carries.

Video stream URLs are also absent. `MediaQuality.VIDEO` / `VIDEO_HD` are declared so the
vocabulary is stable, but no builder returns one until the endpoints are confirmed.

## Development

```
npm install
npm run lint
npm run typecheck
npm run build
npm test            # offline, no network at all
```

The offline suite drives the whole client through an injected stub `fetch` and asserts
against JSON fixtures captured from the real API, Hebrew included. See
[`test/fixtures/README.md`](test/fixtures/README.md) for the provenance of each one.

One live test exists and is skipped by default:

```
KOLHALASHON_LIVE=1 npm test
```

It hits rav 674, spaces its calls out, and treats a rate-limited answer as an acceptable
outcome. CI never runs it.

## Licence

MIT.
