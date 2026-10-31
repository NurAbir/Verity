import { loadState, mutate } from '../src/background/storage.js';
import { addUserEntry, removeAllow, removeUserEntry, updateSettings } from '../src/core/state.js';
import { UPDATE_ORIGINS } from '../src/config.js';
import { loadUpdateStatus } from '../src/background/storage.js';
import { idbStore } from '../src/background/listdb.js';
import { performUpdate } from '../src/background/update-runner.js';
import { $, h, send, DISCLAIMER, dataBanner } from './ui.js';

$('#disclaimer-text').textContent = DISCLAIMER;

const say = (text, ok = false) => { const m = $('#msg'); m.textContent = text; m.className = 'msg ' + (ok ? 'ok' : 'err'); };

async function render() {
  const s = await loadState();
  $('#ack').checked = s.settings.disclaimerAccepted;
  $('#notice').style.borderLeftColor = s.settings.disclaimerAccepted ? 'var(--line)' : 'var(--danger)';
  $('#enabled').checked = s.settings.enabled;
  $('#strict').checked = s.settings.blockCaution;
  $('#auto').checked = s.settings.autoUpdate;

  const rows = s.userList.slice().sort((a, b) => a.fake.localeCompare(b.fake)).map((e) => h('tr', {},
    h('td', { class: 'mono' }, e.fake),
    h('td', { class: 'mono' }, e.real ?? 'not set'),
    h('td', {}, h('button', { 'aria-label': `Remove ${e.fake}`, onclick: async () => { await mutate((st) => removeUserEntry(st, e.fake)); render(); } }, 'Remove'))));
  $('#list tbody').replaceChildren(...rows);
  $('#list').hidden = !rows.length;
  $('#empty').hidden = rows.length > 0;

  const allowed = s.allowlist.map((a) => h('tr', {},
    h('td', { class: 'mono' }, a.domain),
    h('td', {}, a.until ? new Date(a.until).toLocaleString() : 'Always'),
    h('td', {}, h('button', { 'aria-label': `Stop trusting ${a.domain}`, onclick: async () => { await mutate((st) => removeAllow(st, a.domain)); render(); } }, 'Remove'))));
  $('#allowed tbody').replaceChildren(...allowed);
  $('#allowed').hidden = !allowed.length;
  $('#allowed-empty').hidden = allowed.length > 0;
}

const setting = (id, key) => $(id).addEventListener('change', async (e) => {
  await mutate((s) => updateSettings(s, { [key]: e.target.checked }));
  render();
});
setting('#ack', 'disclaimerAccepted');
setting('#enabled', 'enabled');
setting('#strict', 'blockCaution');

$('#add').addEventListener('click', async () => {
  const result = await mutate((s) => addUserEntry(s, $('#fake').value, $('#real').value));
  if (!result.ok) return say(result.error);
  $('#fake').value = ''; $('#real').value = '';
  say('Added.', true);
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
    say(`Imported ${added} of ${entries.length} entries. Invalid ones were skipped.`, true);
    render();
  } catch { say('That file could not be read.'); }
  e.target.value = '';
});

async function showDataInfo() {
  const info = await send({ type: 'verity:data-info' });
  if (!info || info.error) { $('#data-info').textContent = 'Reference data could not be loaded.'; return; }
  const c = info.counts;
  const built = (info.source === 'updated' ? 'Using lists you downloaded. ' : 'Using the lists that came with Verity. ')
    + (info.meta?.builtAt ? `Built ${new Date(info.meta.builtAt).toLocaleDateString()}. ` : '');
  const lines = [`${built}${c.trusted.toLocaleString()} popular sites, ${c.extended.toLocaleString()} more known sites, ${c.brands} protected brands, ${c.feedHosts.toLocaleString()} reported scam addresses.`];
  const banner = dataBanner(info);
  if (banner) lines.push(banner);
  $('#data-info').textContent = lines.join(' ');
}

async function renderUpdateStatus() {
  const st = await loadUpdateStatus();
  const msg = $('#update-msg');
  if (!st) { msg.textContent = ''; $('#update-steps').replaceChildren(); return; }
  msg.className = 'msg ' + (st.ok ? 'ok' : 'err');
  msg.textContent = `${st.ok ? 'Updated' : st.partial ? 'Partly updated' : 'Update failed'} on ${new Date(st.at).toLocaleString()}.`;
  $('#update-steps').replaceChildren(...st.steps.map((x) => h('li', {}, `${x.name}: ${x.ok ? x.detail : x.error}`)));
}

$('#update').addEventListener('click', async () => {
  const button = $('#update');
  const msg = $('#update-msg');
  button.disabled = true;
  msg.className = 'msg';
  try {
    // permissions.request must be the first await so Chrome still counts this as a click
    if (!(await chrome.permissions.request({ origins: UPDATE_ORIGINS }))) {
      msg.className = 'msg err';
      msg.textContent = 'Permission was not given, so nothing was downloaded.';
      return;
    }
    await performUpdate({ onProgress: (name) => { msg.textContent = `Downloading: ${name}…`; } });
    await send({ type: 'verity:reload-data' });
  } catch (err) {
    msg.className = 'msg err';
    msg.textContent = `Update failed: ${err.message}`;
    return;
  } finally {
    button.disabled = false;
  }
  await renderUpdateStatus();
  await showDataInfo();
});

$('#auto').addEventListener('change', async (e) => {
  const want = e.target.checked;
  if (want && !(await chrome.permissions.request({ origins: UPDATE_ORIGINS }))) { e.target.checked = false; return; }
  await mutate((s) => updateSettings(s, { autoUpdate: want }));
});

$('#reset-lists').addEventListener('click', async () => {
  await idbStore.clear();
  await send({ type: 'verity:reload-data' });
  $('#update-msg').className = 'msg ok';
  $('#update-msg').textContent = 'Downloaded lists removed. Verity now uses the lists that came with it.';
  $('#update-steps').replaceChildren();
  showDataInfo();
});

render();
showDataInfo();
renderUpdateStatus();
