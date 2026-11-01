// Small DOM helpers. Text is always inserted with textContent/append(string), never HTML,
// so addresses or reasons can never inject markup into these pages.
import { diffSegments } from '../src/core/diff.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  node.append(...kids.flat().filter((k) => k != null && k !== false));
  return node;
}

export const send = (message) => chrome.runtime.sendMessage(message);

// ---- icons: 24x24 outline set, drawn as SVG (no external files) ----
const ICONS = {
  'shield-alert': 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z|M12 8v5|M12 16.5h.01',
  'shield-check': 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z|M9 12l2 2 4-4',
  'shield-off': 'M12 3l7 3v5c0 1.6-.4 3.1-1 4.4|M5 6v5c0 4.5 3 8.2 7 10 1.2-.5 2.3-1.3 3.2-2.2|M3 3l18 18',
  triangle: 'M12 3.5l10 17.5H2L12 3.5z|M12 10v4.5|M12 17.5h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 11v5|M12 7.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12|M18 6L6 18',
  'arrow-right': 'M5 12h14|M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5|M11 6l-6 6 6 6',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7|M20 4v7h-7',
  trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
  plus: 'M12 5v14|M5 12h14',
  sliders: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
  list: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  download: 'M12 4v11|M7 11l5 5 5-5|M5 20h14',
  upload: 'M12 16V5|M7 9l5-5 5 5|M5 20h14',
  lock: 'M6 11h12v9H6z|M8 11V8a4 4 0 0 1 8 0v3',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M2 12h20|M12 2c3 3 4.5 6.5 4.5 10S15 19 12 22c-3-3-4.5-6.5-4.5-10S9 5 12 2z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4 21c0-4 3.5-6 8-6s8 2 8 6',
  home: 'M3 11l9-8 9 8|M5 10v10h14V10',
};

export function icon(name, size = 20) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' })) svg.setAttribute(k, v);
  for (const d of (ICONS[name] ?? ICONS.info).split('|')) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** Fill every <span data-icon="name" data-size="18"> with its icon. */
export function hydrateIcons(root = document) {
  for (const el of $$('[data-icon]', root)) el.replaceChildren(icon(el.dataset.icon, Number(el.dataset.size) || 20));
}

export function chip(kind, text, iconName) {
  return h('span', { class: `chip chip-${kind}` }, iconName ? icon(iconName, 14) : null, text);
}

// ---- wording shared by the pages ----
export const RULE_LABEL = {
  'user-list': 'On your list',
  'phishing-feed': 'Reported phishing',
  blocklist: 'On a bad-site list',
  'same-name': 'Same name, other ending',
  'lookalike-characters': 'Look-alike characters',
  typo: 'Close spelling',
  'brand-in-name': 'Brand name inside',
  'brand-in-subdomain': 'Brand name in front',
  'international-characters': 'Unusual characters',
};

export const CONFIDENCE = {
  danger: { n: 3, label: 'High confidence', text: 'This address is on a list of bad sites, or on your own list.' },
  warning: { n: 2, label: 'Medium confidence', text: 'The address closely resembles a well-known site. This is a guess based on its name.' },
  caution: { n: 1, label: 'Low confidence', text: 'Something about the address is unusual. It is often a harmless coincidence.' },
};

export const DISCLAIMER = 'Verity can be wrong. It compares web addresses with lists and naming patterns. '
  + 'It can flag a genuine site by mistake, and it can miss a dangerous one. '
  + 'No warning does not mean a site is safe. When in doubt, do not enter passwords, card details or one-time codes. '
  + 'Type the address yourself or use a bookmark you saved earlier.';

export function dataBanner(info) {
  if (info?.degraded) return 'Verity’s list of popular websites is not installed in this copy, so it may raise more false alarms than usual.';
  return null;
}

/**
 * Show a host and mark the characters of its registrable domain that differ from the real domain.
 * Subdomains in front stay unmarked. Returns true if anything was marked.
 */
export function renderAddress(target, host, registrable, real) {
  if (!real || !host.endsWith(registrable)) { target.replaceChildren(host); return false; }
  const prefix = host.slice(0, host.length - registrable.length);
  const segments = diffSegments(registrable, real);
  target.replaceChildren(prefix, ...segments.map((s) => (s.changed ? h('mark', {}, s.text) : s.text)));
  return segments.some((s) => s.changed);
}

export function daysSince(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000)) : null;
}
