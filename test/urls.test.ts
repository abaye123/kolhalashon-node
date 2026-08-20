import { describe, expect, it } from 'vitest';
import {
  KolHalashonUrls,
  ravImageFileName,
  shiurFileName,
  shiurFolderName,
} from '../src/index.js';

describe('file name algorithm', () => {
  it('pads a file id to 8 characters', () => {
    expect(shiurFileName(42740657)).toBe('42740657');
    expect(shiurFileName(1234)).toBe('00001234');
  });

  it('buckets by the first 5 characters', () => {
    expect(shiurFolderName(42740657)).toBe('42740');
    expect(shiurFolderName(1234)).toBe('00001');
  });

  it('pads a rav id to 4 digits, or 6 past 9999', () => {
    expect(ravImageFileName(674)).toBe('0674');
    expect(ravImageFileName(9999)).toBe('9999');
    expect(ravImageFileName(10000)).toBe('010000');
  });

  it('rejects a non-integer file id rather than building a broken URL', () => {
    expect(() => shiurFileName(1.5)).toThrow(TypeError);
    expect(() => KolHalashonUrls.audio(-1)).toThrow(TypeError);
  });
});

describe('KolHalashonUrls', () => {
  // Two known ids pinned to their expected URLs, per the design contract.
  it('builds the audio URL', () => {
    expect(KolHalashonUrls.audio(42740657)).toBe(
      'https://srv.kolhalashon.com/api/files/GetMp3FileToPlay/42740657',
    );
    expect(KolHalashonUrls.audio(1234)).toBe(
      'https://srv.kolhalashon.com/api/files/GetMp3FileToPlay/1234',
    );
  });

  it('builds the thumbnail URL', () => {
    expect(KolHalashonUrls.thumbnail(42740657)).toBe(
      'https://www.kolhalashon.com/imgs/VideoThumbNails/42740/42740657.jpg',
    );
    expect(KolHalashonUrls.thumbnailPreview(1234)).toBe(
      'https://www.kolhalashon.com/imgs/VideoThumbNails/00001/00001234.webp',
    );
  });

  it('builds the rav image URL from a file name and from an id', () => {
    expect(KolHalashonUrls.ravImage('0674.jpg')).toBe(
      'https://www.kolhalashon.com/imgs/Ravs/0674.jpg',
    );
    expect(KolHalashonUrls.ravImageForRavId(674)).toBe(
      'https://www.kolhalashon.com/imgs/Ravs/0674.jpg',
    );
  });

  it('builds the human-facing page URL', () => {
    expect(KolHalashonUrls.shiurPage(42740657)).toBe(
      'https://www.kolhalashon.com/he/regularSite/playShiur/42740657',
    );
    expect(KolHalashonUrls.shiurPage(42740657, 'en')).toBe(
      'https://www.kolhalashon.com/en/regularSite/playShiur/42740657',
    );
  });

  it('honours overridden bases and adds a missing trailing slash', () => {
    expect(KolHalashonUrls.audio(7, { baseUrl: 'https://proxy.example/api' })).toBe(
      'https://proxy.example/api/files/GetMp3FileToPlay/7',
    );
  });
});
