import { describe, expect, it } from 'vitest';
import { KolHalashonClient, KolHalashonRateLimitedError } from '../src/index.js';

/**
 * Opt-in only: `KOLHALASHON_LIVE=1 npm test`.
 *
 * CI never runs this. It documents reality against rav 674 (הרב אלימלך בידרמן), and it is
 * deliberately slow: the API sits behind Cloudflare bot protection that trips on bursts, so
 * the calls are spaced out and a rate-limited result is reported rather than retried.
 */
const live = process.env['KOLHALASHON_LIVE'] === '1';
const RAV_BIDERMAN = 674;

describe.skipIf(!live)('live API', () => {
  it(
    'lists the newest shiurim of rav 674 and counts them',
    async () => {
      const client = new KolHalashonClient({ retries: 0 });
      try {
        const page = await client.ravShiurim({ ravId: RAV_BIDERMAN, rowsPerPage: 3 });
        expect(page.items.length).toBeGreaterThan(0);
        const newest = page.items[0]!;
        expect(newest.ravId).toBe(RAV_BIDERMAN);
        expect(newest.audioUrl).toContain('/files/GetMp3FileToPlay/');

        await new Promise((r) => setTimeout(r, 20_000));

        const count = await client.ravShiurimCount(RAV_BIDERMAN);
        expect(count).toBeGreaterThan(5000);
      } catch (err) {
        if (err instanceof KolHalashonRateLimitedError) {
          // A blocked run still proves the detection path works end to end.
          expect(err.suggestedBackoffSeconds).toBeGreaterThan(0);
          return;
        }
        throw err;
      } finally {
        client.close();
      }
    },
    120_000,
  );
});
