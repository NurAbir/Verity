// Static checks: every file the manifest and the pages point to must exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, UPDATE_ORIGINS } from '../extension/src/config.js';

const ext = resolve(fileURLToPath(new URL('../extension', import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(ext, 'manifest.json'), 'utf8'));

test('manifest: MV3, minimal permissions, strict CSP, files exist', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'alarms', 'storage', 'webNavigation']);
  assert.deepEqual([...manifest.optional_host_permissions].sort(), [...UPDATE_ORIGINS].sort());
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  const files = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
    ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
  for (const f of files) assert.ok(existsSync(resolve(ext, f)), f);
});

test('pages: every script, stylesheet and image reference resolves', () => {
  const pagesDir = resolve(ext, 'pages');
  for (const page of readdirSync(pagesDir).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(resolve(pagesDir, page), 'utf8');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), `${page} has an inline script (blocked by CSP)`);
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:)/.test(ref)) continue;
      assert.ok(existsSync(resolve(pagesDir, ref)), `${page} -> ${ref}`);
    }
  }
});

test('pages never use innerHTML (addresses and reasons are untrusted text)', () => {
  const dirs = [resolve(ext, 'pages'), resolve(ext, 'src/background')];
  for (const dir of dirs) for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(readFileSync(resolve(dir, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')), f);
  }
});

test('network: only config.js names outside addresses, and they match the optional permissions', () => {
  const hosts = new Set(['https://tranco-list.eu/x', 'https://phishunt.io/x', SOURCES.trancoFull('ID'), SOURCES.trancoTop, SOURCES.trancoId, SOURCES.phishFeed]
    .map((u) => new URL(u).origin + '/*'));
  assert.deepEqual([...hosts].sort(), [...UPDATE_ORIGINS].sort());
  for (const dir of ['src/background', 'src/core', 'src/updater', 'pages']) for (const f of readdirSync(resolve(ext, dir)).filter((x) => x.endsWith('.js'))) {
    const code = readFileSync(resolve(ext, dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(code), `${dir}/${f}: unexpected network API`);
    assert.ok(!/https?:\/\/[a-z]/i.test(code), `${dir}/${f}: hard-coded address (put it in config.js)`);
  }
});

test('versions agree between package.json and manifest.json', () => {
  const pkg = JSON.parse(readFileSync(resolve(ext, '../package.json'), 'utf8'));
  assert.equal(pkg.version, manifest.version);
});
