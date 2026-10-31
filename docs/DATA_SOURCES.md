# Data sources

Verity ships a small curated brand list and builds the rest from two public sources. Generated files are git-ignored: rebuild them with `npm run build` or the in-browser **Update lists** button. Both use the same code (`extension/src/core/datasets.js`, `feed.js`).

| Source | Used for | Format | Licence / terms |
|---|---|---|---|
| [Tranco](https://tranco-list.eu) top-1M | Trusted tier (popular sites) and the top ~10k brand-like names | zip of `rank,domain` CSV | Tranco combines several rankings. Some components carry attribution or non-commercial terms (Cloudflare Radar CC BY-NC 4.0, Chrome UX Report CC BY-SA 4.0, Majestic CC BY 3.0). Check them before any commercial use. |
| Tranco full list | "Known to exist" tier (ranks 1M–3M) | CSV | Same as above. The download address in `config.js` is unverified: confirm it against Tranco's API documentation. |
| [phishunt.io](https://phishunt.io) feed | Reported scam sites (fake → brand) | JSON array (`domain`, `company`, ...) | CC0; best-effort data that may contain false positives. |
| `extension/data/brands.json` | Hand-curated brands and their real domains | JSON | This project (MIT). A starter list: verify and extend it. |

## Generated files
| File | Contents |
|---|---|
| `trusted.bin`, `extended.bin` | Sorted 40-bit hashes of domains, 5 bytes each ("VDS1" format, see ARCHITECTURE). 1M domains ≈ 5 MB. |
| `toplabels.json` | `[[label, domain], ...]` brand-like names from the top of the trusted list |
| `feed.json` | `{ hosts, domains }` reported scam addresses mapped to a brand id, with last-seen day |
| `meta.json` | Build time, counts, sources |

## How the lists are used
- A domain in the trusted tier is treated as known popular and not examined further.
- A domain in the extended tier is judged one step more gently (it probably is not brand new).
- Scam-feed entries never block a popular or official domain, because one bad page does not make a whole site bad.
- The feed only lists currently active sites, so entries are kept for 60 days after they were last seen.

## Adding a source
1. Write a parser that returns domains (and a brand when known) in `extension/src/core/` with tests in `test/`.
2. Add its address to `SOURCES` and `UPDATE_ORIGINS` in `config.js` and `optional_host_permissions` in `manifest.json` (a test checks they agree).
3. Use it from both `scripts/` and `extension/src/updater/updater.js`.
4. Document the licence here and in the README.
