import { bool, isRecord, num, str, type Wire } from './parse.js';

/** One top-level category folder on a rav's page. */
export interface RavFolder {
  readonly folderId: number;
  readonly catId: string | null;
  readonly ravId: number | null;
  readonly languageId: number | null;
  /** `RavMainFolder` on the wire: the folder's own identifier within the rav's tree. */
  readonly mainFolder: number | null;
  readonly labelHebrew: string | null;
  readonly labelEnglish: string | null;
  /** How many shiurim hang under this folder. */
  readonly leafCount: number | null;
  readonly hiddenFromPhone: boolean;
  readonly hiddenFromWeb: boolean;
  readonly hiddenFromKiosk: boolean;
  /** Non-zero means the folder needs an access code, so its contents are not public. */
  readonly accessCode: number | null;
}

export function parseRavFolder(raw: unknown): RavFolder | null {
  if (!isRecord(raw)) return null;
  const w: Wire = raw;

  const folderId = num(w, 'FolderId');
  if (folderId === null) return null;

  return {
    folderId,
    catId: str(w, 'CatId'),
    ravId: num(w, 'RavId'),
    languageId: num(w, 'LanguageId'),
    mainFolder: num(w, 'RavMainFolder'),
    labelHebrew: str(w, 'RavMainLabelHebrew'),
    labelEnglish: str(w, 'RavMainLabelEnglish'),
    leafCount: num(w, 'NumberOfLeaves'),
    hiddenFromPhone: bool(w, 'HideFromPhone'),
    hiddenFromWeb: bool(w, 'HideFromWeb'),
    hiddenFromKiosk: bool(w, 'HideFromKiosk'),
    accessCode: num(w, 'AccessCode'),
  };
}

export function parseRavFolders(raw: unknown): RavFolder[] {
  if (!Array.isArray(raw)) return [];
  const out: RavFolder[] = [];
  for (const item of raw) {
    const f = parseRavFolder(item);
    if (f !== null) out.push(f);
  }
  return out;
}
