import { readFileSync } from 'node:fs';
import { DomainSet, packDomains } from '../extension/src/core/domainset.js';
import { buildBrandIndex } from '../extension/src/core/lookalike.js';
import { defaultState } from '../extension/src/core/state.js';

export const brands = JSON.parse(readFileSync(new URL('../extension/data/brands.json', import.meta.url), 'utf8'));

export function makeData(over = {}) {
  return {
    trusted: new DomainSet(packDomains(['wikipedia.org', 'google.de', 'bbc.co.uk', 'github.com', 'mozilla.org'])),
    extended: new DomainSet(packDomains(['paypal.shop', 'smallshop.site'])),
    brandIndex: buildBrandIndex(brands, [['wikipedia', 'wikipedia.org'], ['mozilla', 'mozilla.org']]),
    feed: { hosts: { 'login.evil-bank.xyz': 'paypal' }, domains: { 'evil-bank.xyz': 'paypal' } },
    brands,
    meta: { builtAt: '2026-10-01T00:00:00Z' },
    degraded: false,
    ...over,
  };
}

export const NOW = Date.parse('2026-10-31T00:00:00Z');
export const state = (patch = {}) => ({ ...defaultState(), ...patch });
