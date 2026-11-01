// Glue between the pure updater and the browser: permission check, real storage, status record.
import { activeBlocklists, originsFor } from '../config.js';
import { runUpdate } from '../updater/updater.js';
import { loadData } from './datastore.js';
import { idbStore } from './listdb.js';
import { loadState, saveUpdateStatus } from './storage.js';

let running = false;

/** Throws if permission is missing or an update is already running. Callers must reset the data cache afterwards. */
export async function performUpdate({ onProgress } = {}) {
  if (running) throw new Error('An update is already running.');
  const { settings } = await loadState();
  if (!(await chrome.permissions.contains({ origins: originsFor(settings) }))) {
    throw new Error('Verity does not have permission to download the lists.');
  }
  running = true;
  try {
    const data = await loadData();
    const report = await runUpdate({
      store: idbStore, brands: data.brands, onProgress, lists: activeBlocklists(settings),
      current: { feed: data.feed, trusted: data.trusted, meta: data.meta },
    });
    await saveUpdateStatus(report);
    return report;
  } finally {
    running = false;
  }
}
