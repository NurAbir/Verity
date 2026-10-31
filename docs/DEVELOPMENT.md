# Development guide

## Prerequisites
- Node.js 20.12 or newer (`node --version`)
- Chrome, Edge or Brave
- Git

There are no npm dependencies: `npm install` is not needed.

## Setup
```
git clone https://github.com/NurAbir/verity.git
cd verity
npm test            # everything should pass
npm run build       # downloads the lists into extension/data/ (needs internet)
```
Load `extension/` at `chrome://extensions` (Developer mode → Load unpacked). After editing code, click the reload icon on the Verity card. Pages (warning, popup, settings) pick up changes on reopen.

## Commands
| Command | Purpose |
|---|---|
| `npm test` | All tests (`node --test`) |
| `npm run build:data` | Tranco lists → `trusted.bin`, `extended.bin`, `toplabels.json`, `meta.json`. Options: `--trusted <file\|url>`, `--full <file\|url>`, `--trusted-count`, `--extended-total`, `--top-labels`, `--out` |
| `npm run build:feed` | phishunt feed → `feed.json`. Options: `--from <file>`, `--out` |
| `npm run build` | Both |
| `npm run pack` | `dist/verity-<version>.zip` |

Offline work: `node scripts/build-data.mjs --trusted my-list.csv --full my-full.csv` with any `rank,domain` CSV (or zip).

## Debugging
- **Service worker:** `chrome://extensions` → Verity → "service worker" opens its console. Errors from navigation checks appear there.
- **Pages:** right-click the warning, popup or settings page → Inspect.
- **Storage:** DevTools → Application → IndexedDB (`verity-lists`) and Extension storage.

## Code rules
- Plain ES modules, no bundler, no dependencies. Keep it that way unless there is a strong reason.
- Put logic in `core/` as pure functions and test it. `background/` and `pages/` stay thin.
- Insert text with `textContent` or `append(string)`. Never `innerHTML`.
- No new network address outside `config.js`; no new permission without discussion (tests check both).
- User-facing text is plain English, sentence case, and never promises safety.

## Manual test checklist (before a release)
Use a safe test that does not visit real scam sites.
1. Load unpacked. The settings page opens with the notice. Tick the acknowledgement.
2. Settings → My fake sites: add `example.net` → real `example.com`. Open `https://example.net`. The warning appears with the differing characters marked and "Go to example.com" works.
3. On that warning, **Open this site anyway** stays disabled until the box is ticked; "Open for one hour" opens the site; the site appears in "Sites I chose to trust" and can be removed.
4. Open any normal page, click the Verity icon: it says nothing unusual and offers "Add to my fake list".
5. Turn **Check websites as I browse** off: no warnings. Turn it on again.
6. **Update lists now**: Chrome asks for permission, steps show success, "About the data" says "Using lists you downloaded". **Use the lists that came with Verity** reverts it.
7. Export list, remove an entry, Import list: the entry returns.
8. Reload the extension: settings and list persist.

## Adding things
- **Brand:** edit `extension/data/brands.json`; verify every domain by hand; add it to the cases in `test/verdict.test.mjs`.
- **Rule:** see "Extension points" in [ARCHITECTURE.md](ARCHITECTURE.md).
- **Fixing a wrong warning:** write the failing test first (`test/verdict.test.mjs`), then fix.

## Releasing
1. Update `CHANGELOG.md`; bump `version` in **both** `package.json` and `extension/manifest.json` (a test checks they match).
2. `npm test`, then `npm run build`, then `npm run pack`.
3. Run the manual checklist with the packed build.
4. `git tag v<version>`; `git push --tags`; attach `dist/verity-<version>.zip` to a GitHub release.

## Publishing the repository
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/NurAbir/verity.git
git push -u origin main
```
Maintainer settings worth enabling on GitHub: private vulnerability reporting (Settings → Code security), branch protection on `main` requiring the CI check, and labels `false-positive`, `false-negative`, `bug`, `enhancement`.

## Windows notes
Commands work in PowerShell and cmd. `.gitattributes` keeps line endings as LF. If Git warns about line endings, that is expected.
