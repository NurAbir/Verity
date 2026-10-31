# Architecture

## Principles
1. **The decision is one pure function.** `core/verdict.js` takes a URL and a context and returns a verdict. No browser APIs, so it is tested in Node.
2. **Browser APIs live at the edges.** `background/` and `pages/` are thin adapters.
3. **Fail open.** If anything throws, browsing continues untouched.
4. **One source of truth.** Build logic in `core/` is used by both the CLI scripts and the in-browser updater. Network addresses exist only in `config.js`.
5. **Explainable.** Every finding carries a plain-language reason that the warning page shows.

## Overview

```
 navigation ──► service-worker.js ──► verdict.evaluate(url, {state, data})
                      │                        ▲            ▲
                      │ block                  │            │
                      ▼                 storage.js     datastore.js ◄── IndexedDB (downloaded lists)
              pages/warning.html               │            ▲          └─ extension/data/* (bundled)
              (asks the worker again)    chrome.storage     │
                                                      updater.js ◄── Update button / weekly alarm
```

## Decision pipeline (`core/verdict.js`)
Layers run in order; the first that decides wins.

1. Not a normal website (IP, localhost, `.local`, non-http) → ignore
2. Protection off → ignore
3. Person trusted the site (allowlist, maybe expiring) → ignore
4. Person's fake list → **danger**, real site from the list
5. Official domain of a curated brand → ignore
6. Trusted tier (top 1M) → ignore
7. Reported-scam feed (exact host, or registrable domain for non-popular domains) → **danger**, real site via brand
8. Look-alike rules (`core/lookalike.js`) → **warning** or **caution**; one step gentler if the domain is in the extended tier

`action` is derived from the level: danger/warning → block page; caution → badge (or block in strict mode).

### Look-alike rules
`same-name` (same name, other ending), `lookalike-characters` (skeleton match: `paypa1`, `pay-pal`, `rn`→`m`), `typo` (edit distance 1, or 2 for long names), `brand-in-name` (brand plus extra words; a risk word such as `login` raises it to warning), `brand-in-subdomain`, `international-characters` (`xn--`). Hand-curated brands give warnings; names from the popularity list give cautions only.

## Modules
| Path | Role |
|---|---|
| `core/hash.js`, `domainset.js` | 40-bit hash and the packed sorted set (binary search) |
| `core/hostname.js` | registrable-domain split (built-in suffix table), input validation |
| `core/lookalike.js` | brand index and rules |
| `core/state.js` | every user-state change as a pure function (add entry, trust, settings, migrate) |
| `core/verdict.js` | the pipeline |
| `core/datasets.js`, `feed.js`, `zip.js` | list building, shared by scripts and updater |
| `core/diff.js` | which characters differ (for highlighting) |
| `background/service-worker.js` | navigation listener, badge, weekly alarm, message handler |
| `background/storage.js` | `chrome.storage.local` persistence with serialized read-modify-write |
| `background/datastore.js`, `listdb.js` | loads lists: IndexedDB first, bundled files second |
| `background/update-runner.js` | permission check + real storage around the updater |
| `updater/updater.js` | download, build and save lists; `fetch` and storage injected |
| `pages/` | warning, popup, settings |

## Data formats
**Domain set ("VDS1"):** magic `VDS1` (4 bytes), version (1), key size (1, =5), reserved (2), count (uint32 big-endian), then `count` sorted 5-byte big-endian hashes. Hash = cyrb53 truncated to 40 bits (`hash.js`). Changing the hash invalidates all data files. A false match needs a 40-bit collision.

**Storage keys.** `chrome.storage.local`: `verity` (`{schemaVersion, settings, userList[], allowlist[]}`, repaired by `migrate()` on every read) and `verity-update-status`. IndexedDB `verity-lists` / store `lists`: keys `trusted`, `extended` (bytes), `toplabels`, `feed`, `meta` (JSON).

**Brand entry** (`brands.json`): `{ id, name, domains[], aliases[]? }`. The first domain is the one offered as "the real site".

## Update flow
`Update lists now` → `permissions.request` (must be the first await so it counts as a click) → `performUpdate` → `runUpdate`: fetch Tranco top-1M, fetch the full list (streamed and cancelled at the limit), fetch the scam feed; build; **one IndexedDB transaction** writes everything that succeeded. A failed step keeps its old data; an implausibly small list is refused. The worker is told to reload.

## Security model
- Page text is always inserted as text, never as HTML (a test forbids `innerHTML`).
- The warning page does not trust its URL parameter beyond reading the target address; it asks the worker for the verdict and only navigates to validated plain domains.
- Messages are accepted only from the extension's own pages.
- No content scripts, no host permissions at install, strict CSP, no remote code.
- Requests carry no cookies and no referrer.

## Design decisions
| Decision | Why |
|---|---|
| `webNavigation` + `tabs.update` instead of `declarativeNetRequest` | Rules depend on code (look-alike logic), not a fixed URL list. Trade-off: MV3 cannot block synchronously, so the first request may start before the redirect. |
| Hashes instead of domain text | 1M domains in ~5 MB, fast lookups, no list to read casually. |
| IndexedDB for downloaded lists | Too large for `chrome.storage`. |
| Two tiers | A "known to exist" site is probably not brand new, so judge it more gently, but never trust it fully (the long tail contains spam). |
| Curated brands vs. top names | Only hand-checked brands may cause a full block; names from rankings only cause a badge. Limits false alarms on ordinary sites. |
| Warning page asks the worker | One source of truth, and a crafted link cannot show a fake "real site". |
| Fail open | A security tool that breaks browsing gets uninstalled. |

## Extension points
- **New rule:** add it in `findLookalikes`, give it a reason string and a level, add cases to `test/verdict.test.mjs`.
- **New brand:** add to `extension/data/brands.json` (check the domains), add a test case.
- **New data source:** see [DATA_SOURCES.md](DATA_SOURCES.md).
- **Better suffix handling:** replace `splitDomain` in `hostname.js` with `tldts`, same return shape.
