// Orchestration only: listen for navigations, ask the pure pipeline, act on the answer.
// Fails open: if anything throws, browsing continues untouched.
import { CONFIG } from '../config.js';
import { evaluate } from '../core/verdict.js';
import { loadData, resetData } from './datastore.js';
import { loadState, saveUpdateStatus } from './storage.js';
import { performUpdate } from './update-runner.js';

const ALARM = 'verity-update';
const warningUrl = (target) => chrome.runtime.getURL(CONFIG.WARNING_PAGE) + '?u=' + encodeURIComponent(target);

async function check(url) {
  const [state, data] = await Promise.all([loadState(), loadData()]);
  return evaluate(url, { state, data });
}

function setBadge(tabId, level) {
  const text = level === 'danger' || level === 'warning' ? '!' : level === 'caution' ? '?' : '';
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (text) chrome.action.setBadgeBackgroundColor({ tabId, color: text === '!' ? '#B3261E' : '#8A5300' }).catch(() => {});
}

loadData().catch(() => {}); // warm up as soon as the worker starts

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  try {
    const verdict = await check(d.url);
    if (verdict.action === 'block') {
      setBadge(d.tabId, verdict.level);
      await chrome.tabs.update(d.tabId, { url: warningUrl(d.url) });
    }
  } catch (err) {
    console.warn('[Verity] check failed; allowing navigation', err);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0) return;
  try { setBadge(d.tabId, (await check(d.url)).level); } catch { setBadge(d.tabId, 'none'); }
}, { url: [{ schemes: ['http', 'https'] }] });

// ---- weekly list update (only when the person turned it on) ----
async function syncAlarm() {
  const { settings } = await loadState();
  const existing = await chrome.alarms.get(ALARM);
  if (settings.autoUpdate && !existing) await chrome.alarms.create(ALARM, { delayInMinutes: 60, periodInMinutes: CONFIG.UPDATE_PERIOD_MINUTES });
  else if (!settings.autoUpdate && existing) await chrome.alarms.clear(ALARM);
}

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== ALARM) return;
  try {
    await performUpdate();
    resetData();
  } catch (err) {
    await saveUpdateStatus({ at: Date.now(), ok: false, partial: false, wrote: [], steps: [{ name: 'Automatic update', ok: false, error: err.message }] });
  }
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.verity) syncAlarm().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => syncAlarm().catch(() => {}));

// Extension pages ask the worker, so the verdict has a single source of truth.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || typeof msg?.type !== 'string') return false;
  if (msg.type === 'verity:check' && typeof msg.url === 'string') {
    check(msg.url).then(sendResponse, (err) => sendResponse({ error: String(err) }));
    return true;
  }
  if (msg.type === 'verity:reload-data') {
    resetData();
    loadData().then(() => sendResponse({ ok: true }), (err) => sendResponse({ error: String(err) }));
    return true;
  }
  if (msg.type === 'verity:data-info') {
    loadData().then((d) => sendResponse({
      meta: d.meta, degraded: d.degraded, source: d.source,
      counts: { trusted: d.trusted.size, extended: d.extended.size, brands: d.brands.length,
        feedHosts: Object.keys(d.feed.hosts).length, lookalikeNames: d.brandIndex.size },
      feedGeneratedAt: d.feed.generatedAt,
    }), (err) => sendResponse({ error: String(err) }));
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage(); // first run: show the important notice
  syncAlarm().catch(() => {});
});
