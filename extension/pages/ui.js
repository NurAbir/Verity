// Tiny DOM helpers. Text is always inserted with textContent/append(string), never innerHTML,
// so addresses or reasons can never inject markup into these pages.
import { diffSegments } from '../src/core/diff.js';

export const $ = (sel, root = document) => root.querySelector(sel);

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

/** Render `visited`, wrapping the characters that differ from `real` in <mark>. */
export function renderAddress(target, visited, real) {
  target.replaceChildren(...(real
    ? diffSegments(visited, real).map((s) => (s.changed ? h('mark', {}, s.text) : s.text))
    : [visited]));
}

export const CONFIDENCE = {
  danger: 'High: this address is on a list of known scam sites, or on your own list.',
  warning: 'Medium: the address closely resembles a well-known site. This is a guess based on its name.',
  caution: 'Low: something about the address is unusual. It is often a harmless coincidence.',
};

export const DISCLAIMER = 'Verity can be wrong. It compares web addresses with lists and naming patterns. '
  + 'It can flag a genuine site by mistake, and it can miss a dangerous one. '
  + 'No warning does not mean a site is safe. When in doubt, do not enter passwords, card details or one-time codes. '
  + 'Type the address yourself or use a bookmark you saved earlier.';

export function dataBanner(info) {
  if (!info) return null;
  if (info.degraded) {
    return 'Verity’s list of popular websites is not installed in this copy, so it may raise more false alarms than usual.';
  }
  return null;
}
