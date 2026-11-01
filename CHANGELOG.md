# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow [SemVer](https://semver.org/).

## [1.0.0] - 2026-11-01

First stable release.

### Added
- Look-alike detection: same name with another ending, look-alike characters, typos, brand plus extra words, brand in the subdomain, international characters.
- Personal fake list (fake site to real site) with import and export.
- Warning page that highlights the differing characters, explains why, states how sure Verity is, and offers the real site.
- "Open anyway" (one hour, needs confirmation) and "trust this site".
- Reference data: top 1M popular sites and a 3M "known to exist" tier (Tranco), reported scam sites (phishunt), and public filter lists in uBlock Origin format ("Badware risks", Phishing URL Blocklist).
- **Update lists** button with optional weekly updates; `npm run build` for the same from the command line.
- Optional **Extra coverage** (Phishing.Database), with Chrome asked only for the sites that are switched on.
- Redesigned warning page, popup and settings: severity and confidence shown with icons and text, highlighted character differences, light and dark themes.
- Notices that Verity can be wrong, and for missing or stale lists.
- 67 automated tests, CI on Windows and Linux.
