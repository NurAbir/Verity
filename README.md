# Verity

[![CI](https://github.com/NurAbir/verity/actions/workflows/ci.yml/badge.svg)](https://github.com/NurAbir/verity/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A browser extension that warns you when a website looks like a copy of a well-known one
(`something.site` pretending to be `something.com`) and shows you the real address.
Checks run on your device. Nothing about the sites you visit is sent anywhere.

> **Verity is a helper, not a guarantee.** It looks at web addresses only. It can flag a genuine site by mistake
> and it can miss a dangerous one. No warning does not mean a site is safe.

## Features

- Detects same-name-different-ending, look-alike characters, typos, brand-plus-extra-words and brand-in-subdomain tricks.
- Your own **fake → real** list, with import and export.
- Warning page that highlights exactly which characters differ, explains why, and says how sure it is.
- 1M popular sites + 3M "known to exist" tier (Tranco) and reported scam sites (phishunt), updated with one button.
- Minimal permissions, no analytics, no remote code, no dependencies.

## Install (from source)

Requires Chrome, Edge or Brave, and Node.js 20.12+.

```
git clone https://github.com/NurAbir/verity.git
cd verity
npm run build        # downloads the reference lists into extension/data/ (or use the Update lists button later)
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension` folder.
Full walkthrough: [User guide](docs/USER_GUIDE.md).

## Project structure

```
verity/
├── .github/
│   ├── ISSUE_TEMPLATE/        bug, false alarm, missed scam, feature
│   ├── workflows/ci.yml       tests on Windows + Linux, packaging check
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── USER_GUIDE.md          for people using Verity
│   ├── ARCHITECTURE.md        how it works, data formats, design decisions
│   ├── DEVELOPMENT.md         setup, workflow, manual test checklist, releasing
│   ├── DATA_SOURCES.md        where the lists come from, licences, how to add one
│   └── PRIVACY.md             what is stored, what is contacted, why each permission
├── extension/                 the shipped browser extension (load this folder)
│   ├── manifest.json
│   ├── data/                  brands.json (curated) + generated lists (git-ignored)
│   ├── icons/
│   ├── pages/                 warning, popup, settings (HTML, CSS, ES modules; no build step)
│   └── src/
│       ├── config.js          limits and the only network addresses
│       ├── core/              pure logic, no browser APIs (unit-tested in Node)
│       ├── background/        thin adapters: service worker, storage, IndexedDB, updates
│       └── updater/           in-browser list updater (fetch and storage are injected)
├── scripts/                   build-data, build-feed, pack (+ lib/)
├── test/                      node:test suites
├── CHANGELOG.md  CODE_OF_CONDUCT.md  CONTRIBUTING.md  LICENSE  SECURITY.md
├── package.json  .editorconfig  .gitattributes  .gitignore
└── README.md
```

## Documentation

| I want to... | Read |
|---|---|
| Install and use Verity | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| Understand how it decides | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Run it, test it, change it | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Know where the data comes from | [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) |
| Check what it stores and contacts | [docs/PRIVACY.md](docs/PRIVACY.md) |
| Contribute | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Report a security problem | [SECURITY.md](SECURITY.md) |

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs all tests (no dependencies to install) |
| `npm run build` | Builds the reference lists (`build:data` and `build:feed`) |
| `npm run pack` | Creates `dist/verity-<version>.zip` from `extension/` |

## Licence

Code: [MIT](LICENSE). The reference lists have their own licences, see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).
Verity is not affiliated with any brand it protects.
