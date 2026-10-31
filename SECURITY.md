# Security policy

## Reporting a vulnerability
Please **do not open a public issue**. Use GitHub's private reporting: the repository's **Security** tab → **Report a vulnerability**. Include what you found, how to reproduce it, and the version.

You will get a first reply as soon as the maintainer can, and credit in the changelog if you want it.

## Supported versions
Only the latest release is supported.

## In scope
- Ways to make Verity show a false "real site" or navigate somewhere unintended
- Script injection into Verity's pages
- Leaking browsing data off the device
- Permission or privacy claims in the docs that the code does not honour

## Out of scope
- A scam site that Verity does not detect, or a genuine site it flags: these are detection quality issues, please use the issue templates.
- Problems in Tranco, phishunt or Chrome themselves.

## Design guarantees (tested)
No content scripts, no install-time host permissions, no remote code, no `innerHTML`, and network addresses only in `extension/src/config.js` matching the optional permissions.
