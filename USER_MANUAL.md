# Verity user manual

Verity warns you when a website address looks like a copy of a well-known site, and shows you the real address.

> Verity can be wrong. It can warn about a genuine site and it can miss a dangerous one. No warning does not mean a site is safe.

## Install

Verity is not in an extension store yet, so you load it from the project folder.

1. Get the project (download the ZIP from GitHub and extract it, or `git clone`).
2. Open a terminal in the project folder and run `npm run build`. This downloads the reference lists. You can skip it and use **Update lists now** in the settings page instead.
3. Open `chrome://extensions` (Edge: `edge://extensions`), switch **Developer mode** on, click **Load unpacked**, and choose the **`extension`** folder.
4. The settings page opens. Read the notice and tick the box.

Pin the Verity icon (puzzle-piece menu) so you can see its badge.

## What you will see

| What happens | What it means |
|---|---|
| Full-page red warning | The address looks like a copy of another site, or it is on a list of bad sites, or on your own list. The page shows it next to the real one with the different characters marked. |
| Orange **?** on the icon | Something is unusual, but Verity is not very sure. The page is not stopped. |
| Nothing | Nothing unusual was found. This is **not** a promise that the site is safe. |

Each warning says how sure Verity is: **high** (on a list of bad sites or on your list), **medium** (very similar to a known name), **low** (unusual, often harmless).

## When you get a warning

1. Read the two addresses. Is the top one what you meant to type?
2. If the real site is shown, use **Go to …**, or type the address yourself, or use a saved bookmark.
3. Only if you are sure the site is genuine, open **Open this site anyway**. You must tick a box. "Open for one hour" is temporary. "This site is fine, stop warning me" is permanent (undo it in Settings → Sites I chose to trust).
4. Never enter passwords, card details or one-time codes on a site you are unsure about.

## The toolbar popup

Click the Verity icon to see the status of the page you are on: **No warning**, **Unusual address**, or **Looks like a copy**. For a suspicious page it lists the reasons and offers a button to the real site. The switch at the top turns protection on or off. **Add to my fake list** marks the current site as fake.

## Add a fake site yourself

- **From a page:** click the Verity icon → **Add to my fake list**. Optionally type the real site.
- **From settings:** Settings → My fake sites → type the fake and the real domain (for example `something.site` and `something.com`) → **Add**.

Next time you open the fake site you get the warning and a link to the real one. **Export list** saves a backup file; **Import list** loads one.

## Settings

| Setting | Meaning |
|---|---|
| Check websites as I browse | Master switch. |
| Also stop on weak suspicions | Turns the orange "?" cases into full warnings. More false alarms, fewer misses. |
| Update lists now | Downloads the newest popular-site list, scam reports and filter lists. Chrome asks permission the first time. |
| Update automatically every week | Does the same in the background. Off by default. |
| Extra coverage: Phishing.Database | Adds about 390,000 more phishing domains. The download is about 11 MB each update, and Chrome asks for one more permission. Off by default. |
| Use the lists that came with Verity | Removes downloaded lists and goes back to the bundled ones. |

The **Overview** and **Lists and updates** sections show how many sites are loaded, when the lists were built, which filter lists are active, and whether you use downloaded or bundled lists. Lists older than 30 days trigger a notice on warning pages.

## Troubleshooting

| Problem | What to do |
|---|---|
| "List of popular websites is not installed" | Run `npm run build` and reload the extension, or press **Update lists now**. |
| Update failed | The settings page shows which step failed. A failed step never replaces working data. Check your connection and try again. If only "More known sites" fails, the rest still works. |
| My fake list disappeared | Chrome ties an unpacked extension's storage to its folder path. If you move or rename the folder you get empty storage. Keep the folder in place and use **Export list** as a backup. |
| No warning on a site you expected | Check the master switch and Settings → Sites I chose to trust. Verity only knows the brands in its list, look-alikes of popular names, and the lists it downloaded. |
| After changing any file | `chrome://extensions` → reload icon on Verity. |

## Limits

Verity checks addresses only, not page content. A scam on a brand-new domain that looks nothing like a known name will not be caught. Keep using two-step verification and a password manager. What Verity stores and contacts is described under **Privacy** in the [README](README.md#privacy).
