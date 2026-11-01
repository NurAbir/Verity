import { originsFor } from '../src/config.js';
import { loadState, loadUpdateStatus, mutate } from '../src/background/storage.js';
import { idbStore } from '../src/background/listdb.js';
import { performUpdate } from '../src/background/update-runner.js';
import { addUserEntry, removeAllow, removeUserEntry, updateSettings } from '../src/core/state.js';
import { $, h, icon, chip, hydrateIcons, send, DISCLAIMER, dataBanner, daysSince } from './ui.js';

hydrateIcons();
$('#disclaimer-text').textContent = DISCLAIMER;
$('#version').textContent = `v${chrome.runtime.getManifest().version}`;

let settings = null; // cached so permission requests can run synchronously inside the click

const say = (el, text, tone = 'err') => {          // tone: ok | warn | err (true/false still work)
  const t = tone === true ? 'ok' : tone === false ? 'err' : tone;
  el.className = `msg ${t}`;
  el.replaceChildren(icon(t === 'ok' ? 'check' : t === 'warn' ? 'triangle' : 'x', 16), text);
};
const num = (n) => Number(n ?? 0).toLocaleString();

async function render() {
  const s = await loadState();
  settings = s.settings;
  $('#notice').hidden = s.settings.disclaimerAccepted;
  $('#enabled').checked = s.settings.enabled;
  $('#strict').checked = s.settings.blockCaution;
  $('#auto').checked = s.settings.autoUpdate;
  $('#extended').checked = s.settings.extendedCoverage;

  $('#state-text').textContent = s.settings.enabled ? 'Protection is on' : 'Protection is off';
  $('#state-dot').className = 'dot' + (s.settings.enabled ? '' : ' off');
  $('#state-dot').replaceChildren(icon(s.settings.enabled ? 'shield-check' : 'shield-off', 22));

  const mine = s.userList.slice().sort((a, b) => a.fake.localeCompare(b.fake));
  $('#list tbody').replaceChildren(...mine.map((e) => h('tr', {},
    h('td', { class: 'mono' }, e.fake),
    h('td', { class: 'mono' }, e.real ?? 'not set'),
    h('td', { class: 'num' }, h('button', { class: 'btn ghost sm', 'aria-label': `Remove ${e.fake}`, onclick: async () => { await mutate((st) => removeUserEntry(st, e.fake)); render(); } }, icon('trash', 16), 'Remove')))));
  $('#list').hidden = !mine.length;
  $('#empty').hidden = mine.length > 0;

  $('#allowed tbody').replaceChildren(...s.allowlist.map((a) => h('tr', {},
    h('td', { class: 'mono' }, a.domain),
    h('td', {}, a.until ? new Date(a.until).toLocaleString() : 'Always'),
    h('td', { class: 'num' }, h('button', { class: 'btn ghost sm', 'aria-label': `Stop trusting ${a.domain}`, onclick: async () => { await mutate((st) => removeAllow(st, a.domain)); render(); } }, icon('trash', 16), 'Remove')))));
  $('#allowed').hidden = !s.allowlist.length;
  $('#allowed-empty').hidden = s.allowlist.length > 0;
}

async function renderData() {
  const info = await send({ type: 'verity:data-info' });
  if (!info || info.error) { $('#data-info').textContent = 'Reference data could not be loaded.'; return; }
  const c = info.counts;
  $('#n-trusted').textContent = num(c.trusted);
  $('#n-extended').textContent = num(c.extended);
  $('#n-feed').textContent = num(c.feedHosts);
  $('#n-lists').textContent = String(c.lists?.length ?? 0);

  const age = daysSince(info.meta?.builtAt);
  const fresh = info.degraded ? chip('danger', 'Popular-site list missing', 'x')
    : age == null ? chip('neutral', 'List date unknown', 'info')
    : age > 30 ? chip('caution', `Lists are ${age} days old`, 'triangle')
    : chip('ok', age === 0 ? 'Lists built today' : `Lists are ${age} day${age === 1 ? '' : 's'} old`, 'check');
  $('#fresh-chip').replaceChildren(fresh);

  const rows = [
    ['Popular sites (Tranco top 1M)', c.trusted, 'Tranco terms'],
    ['Known sites (Tranco 1M to 3M)', c.extended, 'Tranco terms'],
    ['Reported scam sites (phishunt)', c.feedHosts, 'CC0'],
    ...(c.lists ?? []).map((l) => [l.title, l.count, l.license ?? '']),
    ['Curated brands', c.brands, 'MIT'],
  ];
  $('#sources tbody').replaceChildren(...rows.map(([name, n, lic]) => h('tr', {}, h('td', {}, name), h('td', { class: 'num' }, num(n)), h('td', { class: 'muted' }, lic))));
  const banner = dataBanner(info);
  $('#data-info').textContent = (info.source === 'updated' ? 'Using lists you downloaded.' : 'Using the lists that came with Verity.') + (banner ? ` ${banner}` : '');
}

async function renderUpdateStatus() {
  const st = await loadUpdateStatus();
  const msg = $('#update-msg');
  if (!st) { msg.replaceChildren(); msg.className = 'msg'; $('#update-steps').replaceChildren(); return; }
  const when = new Date(st.at).toLocaleString();
  say(msg, st.ok ? `Updated on ${when}.` : st.partial ? `Partly updated on ${when}. Some lists could not be downloaded.` : `Update failed on ${when}. Nothing was changed.`, st.ok ? 'ok' : st.partial ? 'warn' : 'err');
  $('#update-steps').replaceChildren(...st.steps.map((x) => h('li', {}, h('span', { class: x.ok ? 'ok' : 'err' }, icon(x.ok ? 'check' : 'x', 16)), h('span', {}, `${x.name}: ${x.ok ? x.detail : x.error}`))));
}

const setting = (id, key) => $(id).addEventListener('change', async (e) => {
  await mutate((s) => updateSettings(s, { [key]: e.target.checked }));
  render();
});
setting('#enabled', 'enabled');
setting('#strict', 'blockCaution');

$('#ack').addEventListener('click', async () => { await mutate((s) => updateSettings(s, { disclaimerAccepted: true })); render(); });

$('#add').addEventListener('click', async () => {
  const result = await mutate((s) => addUserEntry(s, $('#fake').value, $('#real').value));
  if (!result.ok) return say($('#msg'), result.error);
  $('#fake').value = ''; $('#real').value = '';
  say($('#msg'), 'Added.', true);
  render();
});

$('#export').addEventListener('click', async () => {
  const { userList } = await loadState();
  const url = URL.createObjectURL(new Blob([JSON.stringify({ verity: 1, userList }, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: 'verity-my-list.json' });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

$('#import-btn').addEventListener('click', () => $('#import').click());
$('#import').addEventListener('change', async (e) => {
  try {
    const parsed = JSON.parse(await e.target.files[0].text());
    const entries = Array.isArray(parsed?.userList) ? parsed.userList : [];
    let added = 0;
    await mutate((s) => {
      let next = s;
      for (const entry of entries) { const r = addUserEntry(next, entry?.fake, entry?.real); if (r.ok) { next = r.state; added++; } }
      return next;
    });
    say($('#msg'), `Imported ${added} of ${entries.length} entries. Invalid ones were skipped.`, true);
    render();
  } catch { say($('#msg'), 'That file could not be read.'); }
  e.target.value = '';
});

$('#update').addEventListener('click', async () => {
  const button = $('#update');
  const msg = $('#update-msg');
  button.disabled = true;
  msg.className = 'msg';
  try {
    // permissions.request must be the first await so Chrome still counts this as a click
    if (!(await chrome.permissions.request({ origins: [...originsFor(settings)] }))) {
      say(msg, 'Permission was not given, so nothing was downloaded.');
      return;
    }
    await performUpdate({ onProgress: (name) => msg.replaceChildren(`Downloading: ${name}…`) });
    await send({ type: 'verity:reload-data' });
  } catch (err) {
    say(msg, `Update failed: ${err.message}`);
    return;
  } finally {
    button.disabled = false;
  }
  await renderUpdateStatus();
  await renderData();
});

$('#auto').addEventListener('change', async (e) => {
  const want = e.target.checked;
  if (want && !(await chrome.permissions.request({ origins: [...originsFor(settings)] }))) { e.target.checked = false; return; }
  await mutate((s) => updateSettings(s, { autoUpdate: want }));
});

$('#extended').addEventListener('change', async (e) => {
  const want = e.target.checked;
  if (want && !(await chrome.permissions.request({ origins: [...originsFor({ ...settings, extendedCoverage: true })] }))) { e.target.checked = false; return; }
  await mutate((s) => updateSettings(s, { extendedCoverage: want }));
  say($('#update-msg'), want ? 'Extra coverage is on. Press “Update lists now” to download it.' : 'Extra coverage is off. It is removed at the next update.', true);
});

$('#reset-lists').addEventListener('click', async () => {
  await idbStore.clear();
  await send({ type: 'verity:reload-data' });
  $('#update-steps').replaceChildren();
  say($('#update-msg'), 'Downloaded lists removed. Verity now uses the lists that came with it.', true);
  renderData();
});

render();
renderData();
renderUpdateStatus();
