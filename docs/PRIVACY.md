# Privacy

**Short version:** Verity checks addresses on your device. It sends nothing about the sites you visit to anyone. It contacts the internet only to download two public lists, and only when you press **Update lists now** or turn on weekly updates.

## What Verity can see
For every page you open, Verity sees the address, so it can compare it with its lists. This happens in your browser. The address is not stored, logged or sent.

## What Verity stores (on your device)
| Data | Where | Why |
|---|---|---|
| Settings, your fake list, sites you chose to trust | `chrome.storage.local` | Your choices. Not synced. |
| Result of the last list update | `chrome.storage.local` | Shown in settings. |
| Downloaded lists | IndexedDB (`verity-lists`) | Newer than the bundled lists. |
| Bundled lists | Extension folder (`extension/data/`) | Work without any download. |

Removing the extension deletes all of it. **Use the lists that came with Verity** deletes the downloaded lists. Export list saves your fake list to a file you control.

## What Verity contacts
Only these addresses (defined in `extension/src/config.js`, enforced by a test and by the manifest):
- `tranco-list.eu` for the popular-site rankings
- `phishunt.io` for reported scam sites

Requests are sent without cookies and without a referrer. These servers can see your IP address and that you downloaded the list, like any web download. Nothing else is sent. There are no analytics, no crash reports and no accounts.

## Permissions explained
| Permission | Why |
|---|---|
| `webNavigation` | To see the address of a page as you open it and stop it if it looks like a copy. Chrome describes this as reading your browsing history; Verity does not store it. |
| `storage` | To save your settings and lists. |
| `activeTab` | So the toolbar popup can read the address of the tab you click it on. |
| `alarms` | For the optional weekly update. |
| Optional access to `tranco-list.eu` and `phishunt.io` | Asked only when you first update. You can revoke it in `chrome://extensions` → Details. |

Verity has no content scripts, so it never reads page content, forms, passwords or cookies.
