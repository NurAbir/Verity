// Persistence adapter. All business rules live in core/state.js; this file only reads/writes chrome.storage.local.
// Local (not sync) on purpose: the list never leaves the device, and sync quotas are small.
import { migrate, pruneAllowlist } from '../core/state.js';

const KEY = 'verity';
let queue = Promise.resolve(); // serializes read-modify-write within one extension context

export async function loadState() {
  const raw = (await chrome.storage.local.get(KEY))[KEY];
  return pruneAllowlist(migrate(raw));
}

/**
 * Apply a pure transition. `fn(state)` returns either a new state object or {ok, state, error}.
 * Nothing is saved when ok is false. Always resolves to {ok, state, error?}.
 */
export function mutate(fn) {
  const run = queue.then(async () => {
    const out = fn(await loadState());
    const wrapped = out && out.schemaVersion ? { ok: true, state: out } : out;
    if (wrapped.ok !== false) await chrome.storage.local.set({ [KEY]: wrapped.state });
    return wrapped;
  });
  queue = run.catch(() => {});
  return run;
}

// Outcome of the last list update, shown in settings. Kept apart from the main state so saving it never
// triggers the "settings changed" handlers.
const STATUS_KEY = 'verity-update-status';
export async function loadUpdateStatus() { return (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] ?? null; }
export async function saveUpdateStatus(status) { await chrome.storage.local.set({ [STATUS_KEY]: status }); }
