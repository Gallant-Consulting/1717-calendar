import { describe, expect, it } from 'vitest';
import { CANONICAL_HOST, legacyHostRedirect } from './canonicalHost';

describe('legacyHostRedirect', () => {
  it('sends old calendar hosts to the Good Company host, keeping path and query', () => {
    expect(legacyHostRedirect('calendar.goodcompanyrva.org', '/?event=rec123')).toBe(
      'https://calendar.goodcompanyva.org/?event=rec123',
    );
    expect(legacyHostRedirect('calendar.1717collective.org', '/')).toBe('https://calendar.goodcompanyva.org/');
  });

  it('ignores case, a port, and a trailing dot on the Host header', () => {
    expect(legacyHostRedirect('Calendar.GoodCompanyRVA.org:443', '/x')).toBe('https://calendar.goodcompanyva.org/x');
    expect(legacyHostRedirect('calendar.goodcompanyrva.org.', '/')).toBe('https://calendar.goodcompanyva.org/');
  });

  it('serves the canonical host, Railway, and localhost normally', () => {
    expect(legacyHostRedirect(CANONICAL_HOST, '/')).toBeNull();
    expect(legacyHostRedirect('67pebqd0.up.railway.app', '/health')).toBeNull();
    expect(legacyHostRedirect('localhost:4173', '/')).toBeNull();
    expect(legacyHostRedirect(undefined, '/')).toBeNull();
  });

  it('falls back to the root path when the request path is missing or not absolute', () => {
    expect(legacyHostRedirect('calendar.goodcompanyrva.org', undefined)).toBe('https://calendar.goodcompanyva.org/');
    expect(legacyHostRedirect('calendar.goodcompanyrva.org', 'http://evil.example/')).toBe(
      'https://calendar.goodcompanyva.org/',
    );
  });
});
