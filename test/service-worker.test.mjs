// Wiring test: loads the real service worker against a mock `chrome`, with real data files from disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ext = resolve(fileURLToPath(new URL('../extension', import.meta.url)));
const store = {};
const calls = { update: [], badge: [] };
const listeners = {};
const alarms = new Map();
const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });

globalThis.chrome = {
  runtime: { id: 'test-id', getURL: (p) => pathToFileURL(resolve(ext, p)).href, onMessage: on('message'), onInstalled: on('installed'), onStartup: on('startup'), openOptionsPage() {} },
  alarms: { onAlarm: on('alarm'), get: async (n) => alarms.get(n), create: async (n, info) => { alarms.set(n, info); }, clear: async (n) => alarms.delete(n) },
  permissions: { contains: async () => false },
  storage: { local: {
    get: async (k) => ({ [k]: store[k] }),
    set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))),
  }, onChanged: on('storageChanged') },
  webNavigation: { onBeforeNavigate: on('before'), onCommitted: on('committed') },
  tabs: { update: async (id, props) => { calls.update.push([id, props]); } },
  action: { setBadgeText: async (o) => { calls.badge.push(o); }, setBadgeBackgroundColor: async () => {} },
};
globalThis.fetch = async (url) => {
  const path = fileURLToPath(url);
  if (!existsSync(path)) return { ok: false };
  const buf = readFileSync(path);
  return { ok: true, json: async () => JSON.parse(buf.toString('utf8')), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

await import('../extension/src/background/service-worker.js');

test('suspicious navigation is redirected to the warning page', async () => {
  calls.update.length = 0;
  await listeners.before({ frameId: 0, tabId: 7, url: 'https://paypa1.com/login' });
  assert.equal(calls.update.length, 1);
  assert.equal(calls.update[0][0], 7);
  const target = new URL(calls.update[0][1].url);
  assert.ok(target.pathname.endsWith('/pages/warning.html'));
  assert.equal(target.searchParams.get('u'), 'https://paypa1.com/login');
});

test('normal navigation, sub-frames and unreadable URLs are left alone (fails open)', async () => {
  calls.update.length = 0;
  await listeners.before({ frameId: 0, tabId: 1, url: 'https://my-cooking-blog.xyz/' });
  await listeners.before({ frameId: 3, tabId: 1, url: 'https://paypa1.com/' });
  await listeners.before({ frameId: 0, tabId: 1, url: 'not a url' });
  assert.equal(calls.update.length, 0);
});

test('worker answers check requests from its own pages only', async () => {
  const ask = (msg, sender = { id: 'test-id' }) => new Promise((ok) => {
    const async_ = listeners.message(msg, sender, ok);
    if (!async_) ok(undefined);
  });
  const v = await ask({ type: 'verity:check', url: 'https://paypal.site/' });
  assert.equal(v.action, 'block');
  assert.equal(await ask({ type: 'verity:check', url: 'https://paypal.site/' }, { id: 'someone-else' }), undefined);
  const info = await ask({ type: 'verity:data-info' });
  assert.ok(info.counts.brands > 30);
});

test('without generated lists the extension reports degraded mode instead of failing', async () => {
  const info = await new Promise((ok) => listeners.message({ type: 'verity:data-info' }, { id: 'test-id' }, ok));
  assert.equal(info.degraded, !existsSync(resolve(ext, 'data/trusted.bin')));
});

test('weekly update alarm follows the setting', async () => {
  store.verity = { schemaVersion: 1, settings: { enabled: true, autoUpdate: true }, userList: [], allowlist: [] };
  await listeners.storageChanged({ verity: {} }, 'local');
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(alarms.has('verity-update'));
  assert.equal(alarms.get('verity-update').periodInMinutes, 7 * 24 * 60);
  store.verity.settings.autoUpdate = false;
  await listeners.storageChanged({ verity: {} }, 'local');
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(!alarms.has('verity-update'));
});

test('an automatic update without permission records a clear failure instead of downloading', async () => {
  await listeners.alarm({ name: 'verity-update' });
  const status = store['verity-update-status'];
  assert.equal(status.ok, false);
  assert.match(status.steps[0].error, /permission/i);
});

test('reload-data message answers ok', async () => {
  const res = await new Promise((ok) => listeners.message({ type: 'verity:reload-data' }, { id: 'test-id' }, ok));
  assert.equal(res.ok, true);
});
