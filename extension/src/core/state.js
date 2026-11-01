// Pure state transitions for everything the person can change. Persistence lives in background/storage.js.
import { CONFIG } from '../config.js';
import { normalizeUserDomain, splitDomain } from './hostname.js';

export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { enabled: true, blockCaution: false, disclaimerAccepted: false, autoUpdate: false, extendedCoverage: false },
    userList: [],  // [{ fake, real|null, addedAt }]
    allowlist: [], // [{ domain, until|null, addedAt }]
  };
}

const validEntry = (e) => e && typeof e.fake === 'string' && (e.real == null || typeof e.real === 'string');
const validAllow = (a) => a && typeof a.domain === 'string' && (a.until == null || typeof a.until === 'number');

/** Always returns a usable state, whatever was stored (older versions, hand-edited, corrupted). */
export function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw.settings ?? {};
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      enabled: s.enabled !== false,
      blockCaution: s.blockCaution === true,
      disclaimerAccepted: s.disclaimerAccepted === true,
      autoUpdate: s.autoUpdate === true,
      extendedCoverage: s.extendedCoverage === true,
    },
    userList: Array.isArray(raw.userList) ? raw.userList.filter(validEntry) : [],
    allowlist: Array.isArray(raw.allowlist) ? raw.allowlist.filter(validAllow) : [],
  };
}

/** @returns {{ok:true,state:object}|{ok:false,error:string}} */
export function addUserEntry(state, fakeInput, realInput, now = Date.now()) {
  const fake = normalizeUserDomain(fakeInput);
  if (!fake) return { ok: false, error: 'Enter the fake site as a domain, for example something.site.' };
  const hasReal = String(realInput ?? '').trim() !== '';
  const real = hasReal ? normalizeUserDomain(realInput) : null;
  if (hasReal && !real) return { ok: false, error: 'The real site is not a valid domain, for example something.com.' };
  if (real && splitDomain(real).registrable === splitDomain(fake).registrable) {
    return { ok: false, error: 'The fake and the real site are the same domain.' };
  }
  const rest = state.userList.filter((e) => e.fake !== fake);
  if (rest.length >= CONFIG.MAX_USER_ENTRIES) return { ok: false, error: 'Your list is full.' };
  return { ok: true, state: { ...state, userList: [...rest, { fake, real, addedAt: now }] } };
}

export function removeUserEntry(state, fake) {
  return { ...state, userList: state.userList.filter((e) => e.fake !== fake) };
}

/** Trust a site's registrable domain for `ttlMs` (or permanently when ttlMs is null). */
export function addAllow(state, hostOrUrl, ttlMs, now = Date.now()) {
  let host = hostOrUrl;
  try { host = new URL(hostOrUrl).hostname; } catch { /* already a host */ }
  const domain = splitDomain(host).registrable;
  if (!domain) return state;
  const rest = state.allowlist.filter((a) => a.domain !== domain);
  return { ...state, allowlist: [...rest, { domain, until: ttlMs == null ? null : now + ttlMs, addedAt: now }] };
}

export function removeAllow(state, domain) {
  return { ...state, allowlist: state.allowlist.filter((a) => a.domain !== domain) };
}

export function pruneAllowlist(state, now = Date.now()) {
  const allowlist = state.allowlist.filter((a) => a.until == null || a.until > now);
  return allowlist.length === state.allowlist.length ? state : { ...state, allowlist };
}

export function isAllowed(state, host, now = Date.now()) {
  const { registrable } = splitDomain(host);
  return state.allowlist.some((a) => a.domain === registrable && (a.until == null || a.until > now));
}

export function updateSettings(state, patch) {
  const next = migrate({ ...state, settings: { ...state.settings, ...patch } });
  return { ...state, settings: next.settings };
}
