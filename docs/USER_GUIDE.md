# User guide

Verity warns you when a website address looks like a copy of a well-known site. This guide is for people using it.

> Verity can be wrong. It can warn about a genuine site and it can miss a dangerous one. No warning does not mean a site is safe.

## Install

Verity is not in an extension store yet, so you load it from the project folder.

1. Get the project (download the ZIP from GitHub and extract it, or `git clone`).
2. Open a terminal in the project folder and run `npm run build`. This downloads the reference lists. (You can skip it and use **Update lists** in the settings page later.)
3. Open `chrome://extensions` (Edge: `edge://extensions`), switch **Developer mode** on, click **Load unpacked**, and choose the **`extension`** folder.
4. The settings page opens. Read the notice and tick the box.

Tip: pin the Verity icon (puzzle-piece menu) so you can see its badge.

## What you will see

| What happens | What it means |
|---|---|
| Full-page warning in red | Verity thinks this address is a copy of another site, or it is on a scam list or your own list. The page shows the address next to the real one with the different characters marked. |
| Orange **?** on the icon | Something is unusual, but Verity is not very sure. The page is not stopped. |
| Nothing | Nothing unusual was found. This is **not** a promise that the site is safe. |

Every warning says how sure Verity is: **high** (scam list or your list), **medium** (very similar to a known name), **low** (unusual, often harmless).

## When you get a warning

1. Read the two addresses. Is the top one what you meant to type?
2. If the real site is shown, use **Go to …**, or type the address yourself or use a saved bookmark.
3. Only if you are sure the site is genuine, use **Open this site anyway**. You must tick a box. "Open for one hour" is temporary; "This site is fine, stop warning me" is permanent (undo it in Settings → Sites I chose to trust).
4. Never enter passwords, card details or one-time codes on a site you are unsure about.

## Add a fake site yourself

- **From a page:** click the Verity icon → **Add to my fake list**. Optionally type the real site.
- **From settings:** Settings → My fake sites → type the fake and the real domain (for example `something.site` and `something.com`) → **Add**.

The next time you open the fake site you get the warning and a link to the real one. **Export list** saves a backup file; **Import list** loads one.

## Settings

| Setting | Meaning |
|---|---|
| Check websites as I browse | Master switch. |
| Also stop on weak suspicions | Turns the orange "?" cases into full warnings. More false alarms, fewer misses. |
| Update lists now | Downloads the newest popular-site list and scam list. Chrome asks permission the first time. |
| Update automatically every week | Does the same in the background. Off by default. |
| Use the lists that came with Verity | Removes downloaded lists and goes back to the bundled ones. |

"About the data" shows how many sites are loaded, when the lists were built, and whether you are using downloaded or bundled lists. Lists older than 30 days trigger a notice on warning pages.

## Troubleshooting

- **"List of popular websites is not installed"**: run `npm run build` and reload the extension, or press **Update lists now**.
- **Update failed**: the settings page lists which step failed. A failed step never replaces working data. Check your connection and try again; if only "More known sites" fails, the rest still works.
- **My fake list disappeared**: Chrome ties an unpacked extension's storage to its folder path. If you move or rename the folder, you get empty storage. Keep the folder where it is, and use Export list as a backup.
- **Verity is not warning**: check the master switch, check you did not trust the site (Settings → Sites I chose to trust), and remember Verity only knows brands in its list and look-alikes of popular names.
- **After changing files**: open `chrome://extensions` and click the reload icon on Verity.

## Limits

Verity checks addresses only, not page content. A scam on a brand-new domain that looks nothing like a known name will not be caught. Keep using two-step verification and a password manager. See [PRIVACY.md](PRIVACY.md) for what Verity stores and contacts.
