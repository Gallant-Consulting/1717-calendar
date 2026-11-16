import { describe, expect, it } from 'vitest';
import { PROVIDER_CREDIT } from './siteConfig';

describe('PROVIDER_CREDIT', () => {
  it('credits Good Company on the calendar header', () => {
    expect(PROVIDER_CREDIT.prefix).toBe('Provided by');
    expect(PROVIDER_CREDIT.name).toBe('Good Company');
    expect(PROVIDER_CREDIT.url).toBe('https://goodcompanyva.org/');
  });
});
