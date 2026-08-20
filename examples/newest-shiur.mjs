// Prints the newest shiur of rav 674 (הרב אלימלך בידרמן) and the URL a player would use.
//
// Run from the package root after `npm run build`:
//   node examples/newest-shiur.mjs
//
// This makes exactly two live requests. The API is behind Cloudflare bot protection, so do
// not put it in a loop.

import { KolHalashonClient, KolHalashonRateLimitedError } from '../dist/index.js';

const RAV_BIDERMAN = 674;

const client = new KolHalashonClient();
try {
  const shiur = await client.newestShiur(RAV_BIDERMAN);
  if (!shiur) {
    console.log(`Rav ${RAV_BIDERMAN} has no shiurim.`);
  } else {
    const minutes = shiur.durationSeconds === null ? '?' : Math.round(shiur.durationSeconds / 60);
    console.log(`${shiur.ravNameHebrew}`);
    console.log(`${shiur.titleHebrew}`);
    console.log(`recorded ${shiur.recordDate?.toLocaleString() ?? 'unknown'} - ${minutes} min`);
    console.log(`categories: ${shiur.categories.join(' / ')}`);
    console.log(`audio: ${shiur.audioUrl}`);
    console.log(`page:  ${shiur.pageUrl}`);
  }

  const total = await client.ravShiurimCount(RAV_BIDERMAN);
  console.log(`total shiurim: ${total}`);
} catch (err) {
  if (err instanceof KolHalashonRateLimitedError) {
    console.error(`Rate limited. Wait ${err.suggestedBackoffSeconds}s and try again.`);
    process.exitCode = 75; // EX_TEMPFAIL
  } else {
    throw err;
  }
} finally {
  client.close();
}
