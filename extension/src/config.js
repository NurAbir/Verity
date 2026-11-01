// Central, non-secret configuration. Change values here, not inside modules.
export const CONFIG = Object.freeze({
  NAME: 'Verity',
  ALLOW_ONCE_MS: 60 * 60 * 1000,        // "Open anyway" lasts one hour
  STALE_DATA_DAYS: 30,                  // warn when reference lists are older than this
  MAX_USER_ENTRIES: 5000,
  REPORT_URL: '',                       // your issue tracker; the "Report a mistake" link is hidden while empty
  WARNING_PAGE: 'pages/warning.html',
  // list sizes (must match what the build scripts use)
  TRUSTED_COUNT: 1_000_000,
  EXTENDED_TOTAL: 3_000_000,
  TOP_LABELS: 10_000,
  MIN_TRUSTED_SITES: 100_000,           // refuse to replace the lists with a suspiciously small download
  UPDATE_PERIOD_MINUTES: 7 * 24 * 60,   // weekly, only when the person turns on automatic updates
});

// The ONLY addresses Verity ever contacts, and only when you press "Update lists" (or turn on weekly updates).
// Every host here must also be listed in manifest.json -> optional_host_permissions (a test enforces this).
export const SOURCES = Object.freeze({
  trancoTop: 'https://tranco-list.eu/top-1m.csv.zip',
  trancoId: 'https://tranco-list.eu/top-1m-id',
  trancoFull: (id) => `https://tranco-list.eu/download/${id}/full`, // verify against Tranco's API docs
  phishFeed: 'https://phishunt.io/feed.json',
});

// Filter lists in the formats uBlock Origin uses. Only whole-site entries are read (see core/blocklist.js).
// Each list may have mirrors on the same site, tried in order.
export const BLOCKLISTS = Object.freeze([
  {
    id: 'ubo-badware',
    title: 'uBlock Origin “Badware risks”',
    urls: ['https://ublockorigin.github.io/uAssets/filters/badware.txt', 'https://ublockorigin.github.io/uAssetsCDN/filters/badware.txt'],
    license: 'GPL-3.0',
    minEntries: 500,
  },
  {
    id: 'phishing-filter',
    title: 'Phishing URL Blocklist',
    urls: ['https://curbengh.github.io/malware-filter/phishing-filter-domains.txt', 'https://curbengh.github.io/phishing-filter/phishing-filter-domains.txt'],
    license: 'CC BY-SA 4.0',
    minEntries: 500,
  },
  {
    id: 'phishing-database',
    title: 'Phishing.Database (active domains)',
    urls: ['https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt'],
    license: 'MIT',
    minEntries: 10000,
    optional: true,          // off unless the person turns on "Extra coverage" (large download)
    sizeHint: 'about 11 MB',
  },
]);

const originOf = (url) => `${new URL(url).origin}/*`;
const unique = (urls) => Object.freeze([...new Set(urls.map(originOf))]);

/** Every address Verity could ever contact (must equal manifest optional_host_permissions). */
export const UPDATE_ORIGINS = unique([SOURCES.trancoTop, SOURCES.phishFeed, ...BLOCKLISTS.flatMap((b) => b.urls)]);

/** Filter lists that are switched on for these settings. */
export const activeBlocklists = (settings) => BLOCKLISTS.filter((b) => !b.optional || settings?.extendedCoverage === true);

/** Only the addresses needed for what is switched on: Chrome asks for exactly these. */
export const originsFor = (settings) => unique([SOURCES.trancoTop, SOURCES.phishFeed, ...activeBlocklists(settings).flatMap((b) => b.urls)]);
