// Reads the blocklist formats that uBlock Origin and similar tools use and extracts whole-site entries.
// Supported: Adblock-style network filters (||example.com^, with the options that apply to page loads),
// hosts files (0.0.0.0 example.com) and plain domain lists. Everything else is skipped on purpose:
// cosmetic filters, regex, wildcards, paths and rules that only affect sub-requests (scripts, images, third-party).
import { isIpHost, normalizeHost, splitDomain } from './hostname.js';

const ABP_HOST_RULE = /^(@@)?\|\|([^/^$|*:?#\s]+)(.*)$/;
const HOSTS_LINE = /^(?:0\.0\.0\.0|127\.0\.0\.1|::1?)\s+(\S+)/;
const PLAIN_DOMAIN = /^([A-Za-z0-9_.-]+)\s*(?:#.*)?$/;
const HOST = /^[a-z0-9_]([a-z0-9_.-]*[a-z0-9_])?$/;

const PAGE_OPTIONS = new Set(['doc', 'document', 'all', 'important', 'match-case']); // rule applies to page loads
const HARMLESS_OPTIONS = new Set(['domain', 'from', 'to', 'reason', 'ipaddress']);   // refine or annotate, do not narrow the type

const optionApplies = (opt) => {
  const name = opt.split('=')[0].trim();
  return PAGE_OPTIONS.has(name) || HARMLESS_OPTIONS.has(name);
};

const validHost = (h) => h.length <= 253 && h.includes('.') && HOST.test(h) && !isIpHost(h) && splitDomain(h).label !== '';

/** @returns {{hosts: string[], skipped: number}} unique blocked hosts (exceptions removed) */
export function parseBlocklist(text) {
  const block = new Set();
  const allow = new Set();
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '!' || line[0] === '#' || line[0] === '[') continue; // comments and list headers
    if (/#[@?$%]?#/.test(line)) { skipped++; continue; }                          // cosmetic filters
    let host = null;
    let target = block;
    let m;
    if ((m = ABP_HOST_RULE.exec(line))) {
      const [, exception, h, rest] = m;
      if (!/^(\^|\||\$|$)/.test(rest)) { skipped++; continue; }                   // path, port or wildcard: not a whole-site rule
      const opts = /\$(.+)$/.exec(rest)?.[1].split(',') ?? [];
      if (!opts.every(optionApplies)) { skipped++; continue; }
      host = h;
      if (exception) target = allow;
    } else if ((m = HOSTS_LINE.exec(line)) || (m = PLAIN_DOMAIN.exec(line))) {
      host = m[1];
    } else { skipped++; continue; }
    host = normalizeHost(host);
    if (!validHost(host)) { skipped++; continue; }
    target.add(host);
  }
  for (const h of allow) block.delete(h);
  return { hosts: [...block], skipped };
}

/** `||a.b.example.com^` also covers sub.a.b.example.com: check the host and each parent down to the registrable domain. */
export function candidateHosts(host, registrable) {
  const labels = host.split('.');
  const keep = registrable.split('.').length;
  const out = [];
  for (let i = 0; labels.length - i >= keep; i++) out.push(labels.slice(i).join('.'));
  return out;
}

/** @param lists {{id:string,title:string,set:{has(h:string):boolean}}[]} */
export function matchBlocklists(parts, lists) {
  const candidates = candidateHosts(parts.host, parts.registrable);
  for (const list of lists) {
    for (const host of candidates) if (list.set.has(host)) return { id: list.id, title: list.title, host };
  }
  return null;
}
