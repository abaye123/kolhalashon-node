import { describe, expect, it } from 'vitest';
import { FILTER_SWITCH_ALL, SearchOrder, ShiurLanguage, buildShiurSearchBody } from '../src/index.js';

describe('buildShiurSearchBody', () => {
  it('produces the body the site sends, with defaults applied', () => {
    expect(buildShiurSearchBody({ ravId: 674 })).toEqual({
      QueryType: -1,
      LangID: -1,
      MasechetID: -1,
      DafNo: -1,
      MasechetIDY: -1,
      DafNoY: -1,
      MoedID: -1,
      ParashaID: -1,
      EnglishDisplay: false,
      MasechetIDYOz: -1,
      DafNoYOz: -1,
      FromRow: 0,
      NumOfRows: 24,
      PrefferedLanguage: -1,
      SearchOrder: 7,
      FiltersArray: [],
      GeneralID: 674,
      FilterSwitch: FILTER_SWITCH_ALL,
    });
  });

  it('uses a 111 character FilterSwitch of all ones', () => {
    expect(FILTER_SWITCH_ALL).toHaveLength(111);
    expect(FILTER_SWITCH_ALL).toMatch(/^1+$/);
  });

  it('maps the caller-facing fields onto their wire names', () => {
    const body = buildShiurSearchBody({
      ravId: 12,
      fromRow: 48,
      rowsPerPage: 50,
      order: SearchOrder.SERVER_DEFAULT,
      language: ShiurLanguage.HEBREW,
    });
    expect(body['GeneralID']).toBe(12);
    expect(body['FromRow']).toBe(48);
    expect(body['NumOfRows']).toBe(50);
    expect(body['SearchOrder']).toBe(-1);
    expect(body['PrefferedLanguage']).toBe(1);
  });

  it('rejects nonsense rather than sending it', () => {
    expect(() => buildShiurSearchBody({ ravId: 1.5 })).toThrow(TypeError);
    expect(() => buildShiurSearchBody({ ravId: 1, fromRow: -1 })).toThrow(TypeError);
    expect(() => buildShiurSearchBody({ ravId: 1, rowsPerPage: 0 })).toThrow(TypeError);
  });
});
