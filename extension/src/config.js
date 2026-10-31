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
export const UPDATE_ORIGINS = Object.freeze(['https://tranco-list.eu/*', 'https://phishunt.io/*']);
