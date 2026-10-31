import { CONFIG } from '../src/config.js';
import { mutate } from '../src/background/storage.js';
import { addAllow } from '../src/core/state.js';
import { normalizeUserDomain } from '../src/core/hostname.js';
import { $, h, send, renderAddress, CONFIDENCE, DISCLAIMER, dataBanner } from './ui.js';

const target = new URLSearchParams(location.search).get('u');
$('#disclaimer-text').textContent = DISCLAIMER;

function parseTarget(raw) {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch { return null; }
}

function headlineFor(verdict) {
  const top = verdict.findings[0];
  const brand = top?.brandName;
  if (top?.rule === 'user-list') return ['You marked this site as fake', 'This address is on your own list of fake sites.'];
  if (top?.rule === 'phishing-feed') return ['This address is on a list of reported scam sites', brand ? `It was reported as imitating ${brand}.` : 'Do not sign in or pay here.'];
  if (top?.rule === 'international-characters') return ['This address uses unusual characters', 'Some characters can imitate ordinary letters.'];
  if (verdict.level === 'caution') return ['This address looks a little unusual', 'Verity is not very sure. Check the address before you continue.'];
  return [brand ? `This may be a copy of ${brand}` : 'This address may be a copy of another site', 'Verity cannot be sure. Check the address below before you sign in or pay.'];
}

function go(url) { location.replace(url); }

async function trust(ttl) {
  await mutate((s) => addAllow(s, target, ttl));
  go(target);
}

async function main() {
  const url = target && parseTarget(target);
  if (!url) {
    $('#headline').textContent = 'This link could not be checked';
    $('#lead').textContent = 'The address is missing or not a normal web address.';
    return;
  }
  const [verdict, info] = await Promise.all([send({ type: 'verity:check', url: url.href }), send({ type: 'verity:data-info' })]);
  if (!verdict || verdict.error) {
    $('#headline').textContent = 'Verity could not check this address';
    $('#lead').textContent = 'Something went wrong, so no check was made. You can still continue, but treat the site with care.';
    $('#actions').hidden = false;
    $('#go-back').addEventListener('click', goBack);
    $('#go-real').hidden = false; $('#go-real').textContent = 'Continue to the site'; $('#go-real').addEventListener('click', () => go(url.href));
    return;
  }
  if (verdict.action !== 'block') { go(url.href); return; } // trusted since, or settings changed: nothing to warn about

  document.body.dataset.level = verdict.level;
  const [headline, lead] = headlineFor(verdict);
  document.title = `Verity: ${headline}`;
  $('#headline').textContent = headline;
  $('#lead').textContent = lead;

  const banner = dataBanner(info) ?? (verdict.dataAgeDays != null && verdict.dataAgeDays > CONFIG.STALE_DATA_DAYS
    ? `Verity’s reference lists are ${verdict.dataAgeDays} days old, so newer scam sites may be missed.` : null);
  if (banner) { $('#data-banner').textContent = banner; $('#data-banner').hidden = false; }

  const visited = verdict.registrable || verdict.host;
  const real = verdict.real[0]?.domain;
  renderAddress($('#visited'), verdict.host, real ? visited : null);
  if (real) {
    $('#real').textContent = real;
    $('#row-real').hidden = false;
    $('#real-caution').hidden = false;
    $('#go-real').hidden = false;
    $('#go-real').textContent = `Go to ${real}`;
    $('#go-real').addEventListener('click', () => {
      const safe = normalizeUserDomain(real); // never navigate to anything that is not a plain domain
      if (safe) go(`https://${safe}/`);
    });
  }
  $('#compare').hidden = false;

  const reasons = $('#reasons');
  reasons.replaceChildren(...verdict.findings.map((f) => h('li', {}, f.reason)));
  $('#confidence').textContent = 'How sure is Verity? ' + (CONFIDENCE[verdict.level] ?? CONFIDENCE.caution);
  $('#why').hidden = false;
  $('#actions').hidden = false;
  $('#override').hidden = false;
  $('#go-back').addEventListener('click', goBack);

  const box = $('#understand');
  for (const id of ['#open-once', '#open-always']) box.addEventListener('change', () => { $(id).disabled = !box.checked; });
  $('#open-once').addEventListener('click', () => trust(CONFIG.ALLOW_ONCE_MS));
  $('#open-always').addEventListener('click', () => trust(null));

  if (CONFIG.REPORT_URL) { $('#report-link').href = CONFIG.REPORT_URL; $('#report').hidden = false; }
}

async function goBack() {
  if (history.length > 1) history.back();
  else { const tab = await chrome.tabs.getCurrent(); if (tab?.id != null) chrome.tabs.remove(tab.id); }
}

main().catch(() => { $('#headline').textContent = 'Verity could not check this address'; });
