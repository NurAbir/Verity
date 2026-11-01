// The decision pipeline. One pure function: (url, context) -> verdict.
// Layers run in this order and stop at the first that decides:
//   1 unsupported/local address -> none     2 disabled -> none       3 person trusted it -> none
//   4 person's own fake list -> danger      5 official brand domain -> none
//   6 popular site (trusted tier) -> none   7 reported-scam feed (brand known) -> danger
//   8 public filter lists (uBlock-style) -> danger   9 look-alike rules (gentler if in the larger list) -> warning/caution
import { isIpHost, isSameOrSubdomain, normalizeHost, splitDomain } from './hostname.js';
import { isAllowed } from './state.js';
import { matchBlocklists } from './blocklist.js';
import { findLookalikes, LEVEL_RANK, maxLevel } from './lookalike.js';

const LOCAL_ENDINGS = ['.local', '.localhost', '.internal', '.lan', '.home', '.test', '.example', '.invalid'];

function result(base, level, extra = {}) {
  return { level, action: 'none', findings: [], real: [], tier: 'unknown', ...base, ...extra };
}

function actionFor(level, settings) {
  if (level === 'danger' || level === 'warning') return 'block';
  if (level === 'caution') return settings.blockCaution ? 'block' : 'badge';
  return 'none';
}

function dataFlags(data, now) {
  const builtAt = Date.parse(data.meta?.builtAt ?? '');
  return {
    dataAgeDays: Number.isFinite(builtAt) ? Math.max(0, Math.floor((now - builtAt) / 86_400_000)) : null,
    degraded: Boolean(data.degraded),
  };
}

/**
 * @param {string} urlString
 * @param {{state:object, data:object, now?:number}} ctx
 *   data: { trusted, extended (DomainSet-like), brandIndex, feed:{hosts,domains}, brands, meta, degraded }
 */
export function evaluate(urlString, { state, data, now = Date.now() }) {
  let url;
  try { url = new URL(urlString); } catch { return result({ url: urlString, host: '' }, 'none', { reason: 'unreadable-url' }); }
  const host = normalizeHost(url.hostname);
  const base = { url: url.href, host, ...dataFlags(data, now) };

  if (!/^https?:$/.test(url.protocol) || !host.includes('.') || isIpHost(host) || LOCAL_ENDINGS.some((e) => host.endsWith(e))) {
    return result(base, 'none', { reason: 'not-applicable' });
  }
  if (!state.settings.enabled) return result(base, 'none', { reason: 'disabled' });

  const parts = splitDomain(host);
  const b = { ...base, registrable: parts.registrable };
  if (isAllowed(state, host, now)) return result(b, 'none', { reason: 'allowed-by-user' });

  const mine = state.userList.find((e) => isSameOrSubdomain(host, e.fake));
  if (mine) {
    return result(b, 'danger', {
      action: 'block',
      findings: [{ rule: 'user-list', level: 'danger', brandId: '', brandName: '', real: mine.real ?? '',
        reason: 'You added this site to your own list of fake sites.' }],
      real: mine.real ? [{ domain: mine.real, brand: '' }] : [],
    });
  }

  if (data.brandIndex.official.has(parts.registrable)) return result(b, 'none', { reason: 'official-site', tier: 'trusted' });
  if (data.trusted.has(parts.registrable)) return result(b, 'none', { reason: 'popular-site', tier: 'trusted' });
  const tier = data.extended.has(parts.registrable) ? 'extended' : 'unknown';

  const feedHit = data.feed.hosts?.[host] ?? data.feed.domains?.[parts.registrable];
  if (feedHit) {
    const brandId = typeof feedHit === 'string' ? feedHit : feedHit.b;
    const brand = data.brands?.find((x) => x.id === brandId);
    return result({ ...b, tier }, 'danger', {
      action: 'block',
      findings: [{ rule: 'phishing-feed', level: 'danger', brandId: brand?.id ?? '', brandName: brand?.name ?? '',
        real: brand?.domains[0] ?? '',
        reason: 'This address appears in a public list of reported phishing sites' + (brand ? `, listed as imitating ${brand.name}.` : '.') }],
      real: brand ? [{ domain: brand.domains[0], brand: brand.name }] : [],
    });
  }

  const lookalikes = findLookalikes(parts, data.brandIndex);
  const realFrom = (fs) => {
    const out = [];
    for (const f of [...fs].sort((x, y) => LEVEL_RANK[y.level] - LEVEL_RANK[x.level])) {
      if (f.real && !out.some((r) => r.domain === f.real)) out.push({ domain: f.real, brand: f.brandName });
    }
    return out.slice(0, 2);
  };

  const listHit = matchBlocklists(parts, data.blocklists ?? []);
  if (listHit) {
    return result({ ...b, tier }, 'danger', {
      action: 'block',
      findings: [{ rule: 'blocklist', level: 'danger', brandId: '', brandName: '', real: '', list: listHit.id,
        reason: `This address is on a public list of known bad sites: ${listHit.title}.` }, ...lookalikes],
      real: realFrom(lookalikes), // if the name also copies a known brand, offer that brand's real site
    });
  }

  let findings = lookalikes;
  if (tier === 'extended') {
    // The domain exists in the larger list, so it is probably not brand new: lower our confidence one step.
    findings = findings.map((f) => (f.level === 'warning' ? { ...f, level: 'caution' } : f));
  }
  const level = findings.reduce((acc, f) => maxLevel(acc, f.level), 'none');
  return result({ ...b, tier }, level, { action: actionFor(level, state.settings), findings, real: realFrom(findings) });
}
