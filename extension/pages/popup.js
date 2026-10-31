import { mutate } from '../src/background/storage.js';
import { addUserEntry } from '../src/core/state.js';
import { splitDomain } from '../src/core/hostname.js';
import { $, h, send } from './ui.js';

$('#settings').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

const REASON_TEXT = {
  'not-applicable': 'Verity does not check this kind of page.',
  disabled: 'Protection is turned off in settings.',
  'allowed-by-user': 'You chose to trust this site.',
  'official-site': 'This is a known official address. That is not a guarantee about every page on it.',
  'popular-site': 'This is a very popular site. Verity found nothing unusual in its name.',
};

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const verdict = url ? await send({ type: 'verity:check', url }) : null;
  if (!verdict || verdict.error) { $('#host').textContent = 'No page to check'; $('#status').hidden = true; return; }

  $('#host').textContent = verdict.host || 'This page';
  document.body.dataset.level = verdict.level;
  const status = $('#status');
  const text = $('#status-text');

  if (verdict.level === 'none') {
    text.textContent = (REASON_TEXT[verdict.reason] ?? 'Verity found nothing unusual in this address.')
      + (verdict.reason === undefined && verdict.tier === 'unknown' ? ' It is not on the popular-site list, so only its name was checked.' : '');
  } else {
    status.classList.add(verdict.level === 'caution' ? 'caution' : 'bad');
    text.textContent = verdict.level === 'caution' ? 'Something about this address is unusual.' : 'This address looks suspicious.';
    $('#reasons').replaceChildren(...verdict.findings.map((f) => h('li', {}, f.reason)));
  }

  const canMark = /^https?:/.test(url) && verdict.registrable && verdict.reason !== 'not-applicable';
  if (canMark) {
    $('#mark').hidden = false;
    $('#mark-btn').addEventListener('click', async () => {
      const msg = $('#msg');
      const result = await mutate((s) => addUserEntry(s, splitDomain(verdict.host).registrable, $('#real').value));
      msg.className = 'msg small ' + (result.ok ? 'ok' : 'err');
      msg.textContent = result.ok ? 'Added. Reloading the page…' : result.error;
      if (result.ok) { await chrome.tabs.reload(tab.id); window.close(); }
    });
  }
}

main().catch(() => { $('#host').textContent = 'Verity could not check this page'; });
