// Look-alike detection. Pure functions: no browser APIs, fully unit-tested.
// Every finding carries a plain-language reason because the UI shows it to the person.
import { splitDomain } from './hostname.js';

export const LEVEL_RANK = Object.freeze({ none: 0, caution: 1, warning: 2, danger: 3 });
export const maxLevel = (a, b) => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);

const MIN_CURATED_LABEL = 3; // "dhl", "ups"
const MIN_TOP_LABEL = 5;     // names from the big popularity list must be long enough to be distinctive
const MIN_TYPO_LABEL = 5;
const MIN_CONTAINS_LABEL = 7;
const TLD_WORDS = new Set(['com', 'net', 'org', 'co', 'io', 'gov', 'edu']);
// Words scammers add to a brand name. Without one of these, "apple-pie" is more likely a recipe blog.
const RISK_WORDS = new Set(['login', 'signin', 'secure', 'security', 'verify', 'verification', 'account', 'accounts',
  'support', 'update', 'wallet', 'billing', 'pay', 'payment', 'help', 'service', 'services', 'online', 'official',
  'auth', 'authenticator', 'recover', 'recovery', 'confirm', 'alert', 'id']);
const CONFUSABLE = { 0: 'o', 1: 'l', i: 'l', 3: 'e', 5: 's', $: 's' };

/** Reduce a name to the shape a human eye sees: paypa1 / paypaI / pay-pal / rnicrosoft all collapse. */
export function skeleton(label) {
  return label.toLowerCase().replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/[01i35$]/g, (c) => CONFUSABLE[c]).replace(/-/g, '');
}

/** Optimal-string-alignment edit distance; returns max+1 early once the limit is exceeded. */
export function editDistance(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * @param {{id:string,name:string,domains:string[],aliases?:string[]}[]} brands hand-curated, high confidence
 * @param {[string,string][]} topPairs [label, domain] from the popularity list, medium confidence
 */
export function buildBrandIndex(brands = [], topPairs = []) {
  const byLabel = new Map();
  const official = new Map(); // registrable domain -> brand
  const add = (entry) => { if (!byLabel.has(entry.label)) byLabel.set(entry.label, entry); };

  for (const b of brands) {
    const labels = new Set(b.aliases ?? []);
    for (const d of b.domains) {
      const p = splitDomain(d);
      official.set(p.registrable, b);
      if (p.label) labels.add(p.label);
    }
    for (const label of labels) {
      if (label.length >= MIN_CURATED_LABEL) add({ id: b.id, name: b.name, label, curated: true, domains: b.domains });
    }
  }
  for (const [label, domain] of topPairs) {
    if (label.length >= MIN_TOP_LABEL) add({ id: 'top:' + domain, name: domain, label, curated: false, domains: [domain] });
  }

  const all = [...byLabel.values()];
  const bySkeleton = new Map();
  const byLength = new Map();
  for (const e of all) {
    e.skeleton = skeleton(e.label);
    (bySkeleton.get(e.skeleton) ?? bySkeleton.set(e.skeleton, []).get(e.skeleton)).push(e);
    (byLength.get(e.label.length) ?? byLength.set(e.label.length, []).get(e.label.length)).push(e);
  }
  return { byLabel, bySkeleton, byLength, curated: all.filter((e) => e.curated), official, size: all.length };
}

/** @returns {{rule:string, level:'caution'|'warning', brandId:string, brandName:string, real:string, reason:string}[]} */
export function findLookalikes(parts, index) {
  const { label, registrable, suffix, subLabels } = parts;
  const findings = [];
  const seen = new Set();
  const add = (rule, level, e, reason) => {
    const key = rule + '|' + e.id;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ rule, level, brandId: e.id, brandName: e.name, real: e.domains[0], reason });
  };

  if (label) {
    const same = index.byLabel.get(label);
    if (same && !same.domains.includes(registrable)) {
      add('same-name', same.curated ? 'warning' : 'caution', same,
        `The name “${label}” is the name of ${same.name} (${same.domains[0]}), but this address ends in “.${suffix}”.`);
    }

    const sk = skeleton(label);
    for (const e of index.bySkeleton.get(sk) ?? []) {
      if (e.label !== label) {
        add('lookalike-characters', e.curated ? 'warning' : 'caution', e,
          `“${label}” looks like “${e.label}” (${e.name}) once look-alike characters or hyphens are ignored.`);
      }
    }

    if (label.length >= MIN_TYPO_LABEL) {
      const max = label.length >= 9 ? 2 : 1;
      for (let len = label.length - max; len <= label.length + max; len++) {
        for (const e of index.byLength.get(len) ?? []) {
          if (e.label === label || e.label.length < MIN_TYPO_LABEL) continue;
          const d = editDistance(label, e.label, max);
          if (d <= max) {
            add('typo', e.curated && d === 1 ? 'warning' : 'caution', e,
              `“${label}” is ${d === 1 ? 'one letter' : 'two letters'} away from “${e.label}” (${e.name}).`);
          }
        }
      }
    }

    for (const e of index.curated) {
      if (e.label === label) continue;
      const tokens = label.split('-');
      if (tokens.length > 1 && e.label.length >= 4 && tokens.includes(e.label)) {
        add('brand-in-name', tokens.some((t) => RISK_WORDS.has(t)) ? 'warning' : 'caution', e,
          `The name contains “${e.label}”, the name of ${e.name}, with extra words added.`);
      } else if (e.label.length >= MIN_CONTAINS_LABEL && label.includes(e.label)) {
        add('brand-in-name', 'caution', e, `The name contains “${e.label}”, the name of ${e.name}, with extra letters around it.`);
      }
    }
  }

  subLabels.forEach((sub, i) => {
    const e = index.byLabel.get(sub);
    if (e?.curated && sub.length >= 4 && !e.domains.includes(registrable)) {
      const followedByTld = TLD_WORDS.has(subLabels[i + 1] ?? '');
      add('brand-in-subdomain', followedByTld ? 'warning' : 'caution', e,
        `“${sub}” appears at the front of the address, but the site itself is “${registrable}”.`);
    }
  });

  if (/(^|\.)xn--/.test(parts.host) && !findings.length) {
    findings.push({ rule: 'international-characters', level: 'caution', brandId: '', brandName: '', real: '',
      reason: 'The address uses international characters, which can be used to imitate letters in a familiar name.' });
  }
  return findings;
}
