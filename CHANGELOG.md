# Changelog

All notable changes are listed here. Format: [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/).

## [0.1.0] - 2026-10-31

First public version.

### Added
- Look-alike detection: same name with a different ending, look-alike characters, typos, brand name plus extra words, brand name in the subdomain, international characters.
- Personal fake list (fake site to real site), with import and export.
- Warning page that highlights the differing characters, explains why, states how sure Verity is, and offers the real site.
- "Open anyway" (one hour, needs confirmation) and "trust this site" actions.
- Reference lists: top 1M popular sites and a 3M "known to exist" tier (Tranco), reported scam sites (phishunt), built by `npm run build` or by the **Update lists** button in the browser (optional weekly updates).
- Notices: Verity can be wrong, stale or missing list banners, first-run notice.
- Documentation, 55 automated tests, CI on Windows and Linux.
