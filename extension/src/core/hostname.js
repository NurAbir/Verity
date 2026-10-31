// Hostname helpers. Getting the "registrable domain" right matters: it decides what counts as "the same site".
// This uses a compact built-in suffix table (country second-level domains + popular shared hosts).
// Shared hosts such as github.io are treated as public suffixes so that evil.github.io is judged on its own.
// Limitation: it is an approximation of the Public Suffix List. If you need full coverage, replace
// splitDomain() with the `tldts` package behind the same return shape; nothing else needs to change.

const MULTI_SUFFIXES = new Set([
  // country second-level domains
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'net.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'co.nz', 'org.nz', 'net.nz',
  'co.in', 'net.in', 'org.in', 'ac.in', 'gov.in', 'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'co.kr',
  'com.br', 'net.br', 'org.br', 'gov.br', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.hk', 'com.sg', 'com.my', 'com.ph', 'com.pk', 'com.np', 'com.lk', 'com.tr', 'com.mx', 'com.ar',
  'com.co', 'co.za', 'org.za', 'com.ng', 'co.ke', 'com.eg', 'com.sa', 'com.ua', 'com.pl', 'co.il',
  'co.id', 'or.id', 'web.id', 'ac.id', 'go.id', 'my.id',
  'com.bd', 'net.bd', 'org.bd', 'edu.bd', 'gov.bd', 'ac.bd', 'mil.bd', 'info.bd',
  // shared hosting / platform domains (each customer is a separate site)
  'github.io', 'gitlab.io', 'blogspot.com', 'wordpress.com', 'netlify.app', 'vercel.app', 'pages.dev',
  'workers.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com', 'onrender.com', 'glitch.me', 'repl.co',
  'weebly.com', 'wixsite.com', 'myshopify.com', 'azurewebsites.net', 'cloudfront.net', 'appspot.com',
  'surge.sh', 'framer.website', 'webflow.io', 'notion.site', 'carrd.co', 'squarespace.com',
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LABEL = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/;

export function normalizeHost(host) {
  return String(host ?? '').trim().toLowerCase().replace(/\.+$/, '');
}

export function isIpHost(host) {
  return IPV4.test(host) || host.includes(':') || host.startsWith('[');
}

/** @returns {{host:string, registrable:string, suffix:string, label:string, subLabels:string[]}} */
export function splitDomain(input) {
  const host = normalizeHost(input);
  const labels = host.split('.');
  const suffixLen = labels.length >= 2 && MULTI_SUFFIXES.has(labels.slice(-2).join('.')) ? 2 : 1;
  if (labels.length <= suffixLen) return { host, registrable: host, suffix: host, label: '', subLabels: [] };
  return {
    host,
    registrable: labels.slice(-(suffixLen + 1)).join('.'),
    suffix: labels.slice(-suffixLen).join('.'),
    label: labels[labels.length - suffixLen - 1],
    subLabels: labels.slice(0, -(suffixLen + 1)),
  };
}

/** True when `host` is `domain` or one of its subdomains. */
export function isSameOrSubdomain(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

/**
 * Turn whatever a person typed ("https://www.Example.com/login") into a clean host, or null if invalid.
 * Unicode names are converted to their xn-- form by the URL parser.
 */
export function normalizeUserDomain(input) {
  let s = String(input ?? '').trim().toLowerCase();
  if (!s || s.length > 300) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/^.*@/, '').replace(/:\d+$/, '');
  try { s = new URL('http://' + s).hostname; } catch { return null; }
  s = normalizeHost(s).replace(/^www\./, '');
  if (s.length > 253 || isIpHost(s)) return null;
  const labels = s.split('.');
  if (labels.length < 2) return null;
  return labels.every((l) => l.length <= 63 && LABEL.test(l)) ? s : null;
}
