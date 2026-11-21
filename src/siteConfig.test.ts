import { describe, expect, it } from 'vitest';
import { GOOD_COMPANY } from './siteConfig';

describe('GOOD_COMPANY', () => {
  it('points the header at Good Company', () => {
    expect(GOOD_COMPANY.name).toBe('Good Company');
    expect(GOOD_COMPANY.url).toBe('https://goodcompanyva.org/');
    expect(GOOD_COMPANY.startNavigatingUrl).toBe('https://goodcompanyva.org/needs');
  });
});
