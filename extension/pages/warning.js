import { CONFIG } from '../src/config.js';
import { mutate } from '../src/background/storage.js';
import { addAllow } from '../src/core/state.js';
import { normalizeUserDomain } from '../src/core/hostname.js';
import { $, h, icon, chip, hydrateIcons, send, renderAddress, CONFIDENCE, RULE_LABEL, DISCLAIMER, dataBanner, daysSince } from './ui.js';

hydrateIcons();
$('#disclaimer-text').textContent = DISCLAIMER;
$('#open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

const target = new URLSearchParams(location.search).get('u');

function parseTarget(raw) {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch { return null; }
}

function headlineFor(verdict) {
  const top = verdict.findings[0];
  const brand = top?.brandName;
  switch (top?.rule) {
    case 'user-list': return ['You marked this site as fake', 'This address is on your own list of fake sites.'];
    case 'phishing-feed': return ['This address is on a list of reported scam sites', brand ? `It was reported as imitating ${brand}. Do not sign in or pay here.` : 'Do not sign in or pay here.'];
    case 'blocklist': return ['This address is on a list of known bad sites', brand ? `It also looks like a copy of ${brand}.` : 'Do not download or sign in here.'];
    case 'international-characters': return ['This address uses unusual characters', 'Some characters can imitate ordinary letters.'];
    default:
      if (verdict.level === 'caution') return ['This address looks a little unusual', 'Verity is not very sure. Check the address before you continue.'];
      return [brand ? `This may be a copy of ${brand}` : 'This address may be a copy of another site', 'Verity cannot be sure. Check the address below before you sign in or pay.'];
  }
}

const go = (url) => location.replace(url);

async function trust(ttl) {
  await mutate((s) => addAllow(s, target, ttl));
  go(target);
}

async function goBack() {
  if (history.length > 1) history.back();
  else { const tab = await chrome.tabs.getCurrent(); if (tab?.id != null) chrome.tabs.remove(tab.id); }
}

function showBanner(text) {
  $('#data-banner-text').textContent = text;
  $('#data-banner').hidden = false;
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
    const primary = $('#go-primary');
    primary.textContent = 'Continue to the site';
    primary.addEventListener('click', () => go(url.href));
    $('#go-back').addEventListener('click', goBack);
    $('#actions').hidden = false;
    return;
  }
  if (verdict.action !== 'block') { go(url.href); return; } // trusted since, or settings changed: nothing to warn about

  document.body.dataset.level = verdict.level;
  const [headline, lead] = headlineFor(verdict);
  document.title = `Verity: ${headline}`;
  $('#headline').textContent = headline;
  $('#lead').textContent = lead;
  const conf = CONFIDENCE[verdict.level] ?? CONFIDENCE.caution;
  $('#confidence-chip').replaceWith(chip(verdict.level === 'caution' ? 'caution' : 'danger', conf.label, verdict.level === 'caution' ? 'triangle' : 'shield-alert'));
  $('#hero-icon').replaceChildren(icon(verdict.level === 'caution' ? 'triangle' : 'shield-alert', 26));

  const age = verdict.dataAgeDays ?? daysSince(info?.meta?.builtAt);
  const banner = dataBanner(info) ?? (age != null && age > CONFIG.STALE_DATA_DAYS ? `Verity’s reference lists are ${age} days old, so newer scam sites may be missed.` : null);
  if (banner) showBanner(banner);

  const visited = verdict.registrable || verdict.host;
  const real = verdict.real[0]?.domain;
  const marked = renderAddress($('#visited'), verdict.host, visited, real);
  $('#compare').hidden = false;
  $('#legend').hidden = !(real && marked);

  const primary = $('#go-primary');
  if (real) {
    $('#real').textContent = real;
    $('#row-real').hidden = false;
    $('#real-caution').hidden = false;
    primary.replaceChildren(`Go to ${real}`, icon('arrow-right', 18));
    primary.addEventListener('click', () => {
      const safe = normalizeUserDomain(real); // never navigate to anything that is not a plain domain
      if (safe) go(`https://${safe}/`);
    });
    $('#go-back').addEventListener('click', goBack);
  } else {
    primary.replaceChildren(icon('arrow-left', 18), 'Go back');
    primary.addEventListener('click', goBack);
    $('#go-back').hidden = true;
  }
  $('#actions').hidden = false;
  primary.focus();

  $('#reasons').replaceChildren(...verdict.findings.map((f) => h('li', {}, chip(f.level === 'caution' ? 'caution' : 'danger', RULE_LABEL[f.rule] ?? 'Unusual'), h('span', {}, f.reason))));
  $('#meter').dataset.level = String(conf.n);
  $('#meter-text').textContent = `${conf.label}. ${conf.text}`;
  $('#why').hidden = false;
  $('#override').hidden = false;

  const box = $('#understand');
  box.addEventListener('change', () => { $('#open-once').disabled = !box.checked; $('#open-always').disabled = !box.checked; });
  $('#open-once').addEventListener('click', () => trust(CONFIG.ALLOW_ONCE_MS));
  $('#open-always').addEventListener('click', () => trust(null));

  if (CONFIG.REPORT_URL) { $('#report-link').href = CONFIG.REPORT_URL; $('#report').hidden = false; }
}

main().catch(() => { $('#headline').textContent = 'Verity could not check this address'; });
