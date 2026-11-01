import { loadState, mutate } from '../src/background/storage.js';
import { addUserEntry, updateSettings } from '../src/core/state.js';
import { normalizeUserDomain, splitDomain } from '../src/core/hostname.js';
import { $, h, icon, chip, hydrateIcons, send, RULE_LABEL } from './ui.js';

hydrateIcons();
$('#version').textContent = `v${chrome.runtime.getManifest().version}`;
$('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

/** Plain-language status for the current page. kind: ok | bad | caution | neutral */
function describe(v) {
  if (v.level === 'danger' || v.level === 'warning') return { kind: 'bad', icon: 'shield-alert', title: v.level === 'danger' ? 'Known bad site' : 'Looks like a copy', text: 'Verity would stop this page.' };
  if (v.level === 'caution') return { kind: 'caution', icon: 'triangle', title: 'Unusual address', text: 'Verity is not very sure. Take care.' };
  const quiet = {
    'not-applicable': { kind: 'neutral', icon: 'info', title: 'Not checked', text: 'Verity does not check this kind of page.' },
    disabled: { kind: 'neutral', icon: 'shield-off', title: 'Protection is off', text: 'Turn the switch on to check sites.' },
    'allowed-by-user': { kind: 'neutral', icon: 'user', title: 'You trust this site', text: 'Verity will not warn about it.' },
    'official-site': { kind: 'ok', icon: 'shield-check', title: 'Known official address', text: 'That is no guarantee about every page on it.' },
    'popular-site': { kind: 'ok', icon: 'shield-check', title: 'No warning', text: 'A very popular site with nothing unusual in its name.' },
  }[v.reason];
  return quiet ?? { kind: 'ok', icon: 'shield-check', title: 'No warning', text: 'Not on the popular-site list, so only its name and the bad-site lists were checked.' };
}

let tab = null;
let verdict = null;

async function refresh() {
  const state = await loadState();
  $('#enabled').checked = state.settings.enabled;
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  verdict = tab?.url ? await send({ type: 'verity:check', url: tab.url }) : null;
  if (!verdict || verdict.error) {
    $('#s-title').textContent = 'No page to check';
    $('#host').textContent = '';
    $('#s-text').textContent = '';
    $('#s-icon').replaceChildren(icon('info', 28));
    return;
  }
  const d = describe(verdict);
  $('#status').className = `status ${d.kind}`;
  $('#s-icon').replaceChildren(icon(d.icon, 28));
  $('#s-title').textContent = d.title;
  $('#host').textContent = verdict.host || '';
  $('#s-text').textContent = d.text;
  $('#reasons').replaceChildren(...verdict.findings.slice(0, 2).map((f) => h('li', {}, chip(f.level === 'caution' ? 'caution' : 'danger', RULE_LABEL[f.rule] ?? 'Unusual'), h('span', {}, f.reason))));

  const real = verdict.real[0]?.domain;
  const goReal = $('#go-real');
  goReal.hidden = !(real && d.kind === 'bad');
  if (real) goReal.replaceChildren(`Go to ${real}`, icon('arrow-right', 16));

  const canMark = /^https?:/.test(tab.url) && verdict.registrable && verdict.reason !== 'not-applicable';
  $('#mark').hidden = !canMark;
}

$('#go-real').addEventListener('click', () => {
  const safe = normalizeUserDomain(verdict?.real?.[0]?.domain);
  if (safe) chrome.tabs.update(tab.id, { url: `https://${safe}/` }).then(() => window.close());
});

$('#enabled').addEventListener('change', async (e) => {
  await mutate((s) => updateSettings(s, { enabled: e.target.checked }));
  refresh();
});

$('#mark-toggle').addEventListener('click', () => {
  const open = $('#mark-form').hidden;
  $('#mark-form').hidden = !open;
  $('#mark-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('#real').focus();
});

$('#mark-btn').addEventListener('click', async () => {
  const msg = $('#msg');
  const result = await mutate((s) => addUserEntry(s, splitDomain(verdict.host).registrable, $('#real').value));
  msg.className = 'msg small ' + (result.ok ? 'ok' : 'err');
  msg.textContent = result.ok ? 'Added. Reloading the page…' : result.error;
  if (result.ok) { await chrome.tabs.reload(tab.id); window.close(); }
});

refresh().catch(() => { $('#s-title').textContent = 'Verity could not check this page'; });
