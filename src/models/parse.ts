/**
 * Wire -> model helpers.
 *
 * Everything here is deliberately permissive. The remote API adds fields without notice and
 * returns `null` in places the site itself tolerates, so a parser that rejects on surprise
 * would break the library every time the site ships. Unknown keys are ignored; a field we
 * cannot read becomes `null` rather than an exception.
 */

export type Wire = Record<string, unknown>;

export function isRecord(v: unknown): v is Wire {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function str(w: Wire, key: string): string | null {
  const v = w[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

export function num(w: Wire, key: string): number | null {
  const v = w[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function bool(w: Wire, key: string, fallback = false): boolean {
  const v = w[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

/**
 * `"01:30:54"` or `"90:54"` -> seconds. Anything else, including `null` and `"00:00:00"`
 * shaped garbage such as `"--"`, yields `null`. Never throws, never silently returns 0
 * for an unparseable value, because a caller cannot tell a real zero from a parse failure.
 */
export function parseDurationSeconds(text: string | null | undefined): number | null {
  if (typeof text !== 'string') return null;
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    nums.push(Number(p));
  }

  if (nums.length === 3) {
    const [h, m, s] = nums as [number, number, number];
    return h * 3600 + m * 60 + s;
  }
  const [m, s] = nums as [number, number];
  return m * 60 + s;
}

/**
 * `"2026-08-18T21:37:19"` -> `Date`.
 *
 * The wire value carries no timezone offset. `new Date(str)` would apply the ES spec rule
 * that a date-time without an offset is UTC, which shifts every timestamp by the viewer's
 * offset. Kol Halashon records these in Israel local wall-clock time, and the site renders
 * them verbatim, so the library parses the components explicitly as **host local time**.
 * If you need Israel time specifically, convert from the components yourself.
 */
export function parseWireDate(text: string | null | undefined): Date | null {
  if (typeof text !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,7}))?)?$/.exec(
    text.trim(),
  );
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const millis = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  const d = new Date(
    year,
    month - 1,
    day,
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0,
    m[6] ? Number(m[6]) : 0,
    millis,
  );
  // Guards against rollover such as 2026-02-30 quietly becoming March 2.
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

/** Collect the non-empty strings from a list of possibly null/blank category descriptions. */
export function compactStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t !== '') out.push(t);
    }
  }
  return out;
}
