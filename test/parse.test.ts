import { describe, expect, it } from 'vitest';
import {
  ShiurLanguage,
  parseDurationSeconds,
  parseRavFolders,
  parseShiur,
  parseShiurim,
  parseWireDate,
  ravFromShiur,
  shiurLanguageName,
} from '../src/index.js';
import { fixtureJson } from './helpers.js';

const rows = fixtureJson<unknown[]>('ravShiurim.rav674.json');

describe('parseShiur', () => {
  const shiur = parseShiur(rows[0]);

  it('maps the wire row onto camelCase fields', () => {
    expect(shiur).not.toBeNull();
    expect(shiur?.fileId).toBe(42740657);
    expect(shiur?.ravId).toBe(674);
    expect(shiur?.folderId).toBe(123977);
    expect(shiur?.downloadCount).toBe(125);
    expect(shiur?.hasAudio).toBe(true);
    expect(shiur?.hasHdVideo).toBe(true);
    expect(shiur?.isLocked).toBe(false);
  });

  it('round-trips Hebrew through the fixture', () => {
    expect(shiur?.ravNameHebrew).toBe('הרב אלימלך בידרמן');
    expect(shiur?.mainTopicHebrew).toBe('שיעורים ושיחות בחסידות');
    expect(shiur?.titleHebrew).toContain('פרשת כי תצא');
    // The captured title genuinely contains a double apostrophe inside a Hebrew abbreviation.
    expect(shiur?.categories[1]).toBe("שיחה שבועית בפרשת השבוע, אש קודש ב''ב");
  });

  it('keeps both titles rather than choosing one', () => {
    expect(shiur?.titleHebrew).not.toBe(shiur?.titleEnglish);
    expect(shiur?.titleEnglish).toContain('Parashat Ki Tetze');
  });

  it('derives duration, date and language', () => {
    expect(shiur?.durationText).toBe('01:30:54');
    expect(shiur?.durationSeconds).toBe(5454);
    expect(shiur?.recordDate?.getFullYear()).toBe(2026);
    expect(shiur?.recordDate?.getMonth()).toBe(7);
    expect(shiur?.recordDate?.getDate()).toBe(18);
    expect(shiur?.recordDate?.getHours()).toBe(21);
    expect(shiur?.language).toBe(ShiurLanguage.YIDDISH);
    expect(shiurLanguageName(shiur?.languageId ?? null)).toBe('YIDDISH');
  });

  it('drops empty categories and keeps the ids alongside', () => {
    expect(shiur?.categories).toHaveLength(2);
    expect(shiur?.categoryIds).toEqual(['000604', '014887']);
    const second = parseShiur(rows[1]);
    expect(second?.categories).toHaveLength(1);
    expect(second?.categoriesEnglish).toEqual(['Shiurim & Sichos in Chasidus']);
  });

  it('precomputes the URLs a player needs', () => {
    expect(shiur?.audioUrl).toBe('https://srv.kolhalashon.com/api/files/GetMp3FileToPlay/42740657');
    expect(shiur?.thumbnailUrl).toBe(
      'https://www.kolhalashon.com/imgs/VideoThumbNails/42740/42740657.jpg',
    );
    expect(shiur?.pageUrl).toBe('https://www.kolhalashon.com/he/regularSite/playShiur/42740657');
  });

  it('ignores unknown wire keys instead of failing', () => {
    const second = parseShiur(rows[1]);
    expect(second?.fileId).toBe(42731234);
    expect(second?.isLocked).toBe(true);
    expect(second?.downloadCount).toBeNull();
    expect(second).not.toHaveProperty('NewFieldTheApiAddedLater');
  });

  it('returns null for an unusable row rather than throwing', () => {
    expect(parseShiur(null)).toBeNull();
    expect(parseShiur([])).toBeNull();
    expect(parseShiur({ TitleHebrew: 'no id here' })).toBeNull();
  });
});

describe('parseShiurim', () => {
  it('skips malformed items and keeps the rest', () => {
    const items = parseShiurim([rows[0], { junk: true }, null, rows[1]]);
    expect(items.map((s) => s.fileId)).toEqual([42740657, 42731234]);
  });

  it('returns an empty list for a non-array', () => {
    expect(parseShiurim({ nope: 1 })).toEqual([]);
  });
});

describe('parseDurationSeconds', () => {
  it.each([
    ['01:30:54', 5454],
    ['00:00:01', 1],
    ['42:07', 2527],
    ['100:00:00', 360000],
  ])('parses %s', (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected);
  });

  it.each([null, undefined, '', '--', 'abc', '1:2:3:4', '01:xx:54'])(
    'yields null for %s rather than 0',
    (input) => {
      expect(parseDurationSeconds(input as string | null)).toBeNull();
    },
  );
});

describe('parseWireDate', () => {
  it('treats the offset-less wire value as local time', () => {
    const d = parseWireDate('2026-08-18T21:37:19');
    expect(d).not.toBeNull();
    // Deliberately asserted with the local getters: parsing as UTC would shift these.
    expect([d?.getFullYear(), d?.getMonth(), d?.getDate()]).toEqual([2026, 7, 18]);
    expect([d?.getHours(), d?.getMinutes(), d?.getSeconds()]).toEqual([21, 37, 19]);
  });

  it('accepts a date-only value and a fractional second', () => {
    expect(parseWireDate('2026-08-18')?.getHours()).toBe(0);
    expect(parseWireDate('2026-08-18T21:37:19.5')?.getMilliseconds()).toBe(500);
  });

  it.each([null, undefined, '', 'not a date', '2026-13-01T00:00:00', '2026-02-30T00:00:00'])(
    'yields null for %s',
    (input) => {
      expect(parseWireDate(input as string | null)).toBeNull();
    },
  );
});

describe('parseRavFolders', () => {
  const folderRows = fixtureJson<unknown[]>('ravFolders.rav674.json');
  const folders = parseRavFolders(folderRows);

  it('maps folders and tolerates an unknown key', () => {
    expect(folders).toHaveLength(2);
    expect(folders[0]?.folderId).toBe(123977);
    expect(folders[0]?.labelHebrew).toBe('שיעורים ושיחות בחסידות');
    expect(folders[0]?.leafCount).toBe(1842);
    expect(folders[1]?.hiddenFromWeb).toBe(true);
    expect(folders[1]?.accessCode).toBe(1);
  });

  it('skips a folder with no id', () => {
    expect(parseRavFolders([{ RavId: 674 }, folderRows[0]])).toHaveLength(1);
  });
});

describe('ravFromShiur', () => {
  it('projects the rav identity off a list item', () => {
    const rav = ravFromShiur(parseShiur(rows[0])!);
    expect(rav?.ravId).toBe(674);
    expect(rav?.nameHebrew).toBe('הרב אלימלך בידרמן');
    expect(rav?.imageUrl).toBe('https://www.kolhalashon.com/imgs/Ravs/0674.jpg');
  });
});
