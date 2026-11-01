# Contributing to Verity

Thanks for helping. Verity is small on purpose and every change should keep it **explainable, private and low-permission**.

## Most useful contributions
- **Report a wrong warning or a missed scam** with the issue template: give the domain only, and why you are sure.
- Add or verify entries in `extension/data/brands.json`, especially local brands.
- Add tests for edge cases; improve wording and docs.

## Making a change
1. Open an issue first for anything bigger than a small fix.
2. Branch from `main`. Setup, commands and code rules are in the [README](README.md#development).
3. **Write a test.** A fix for a false alarm or a missed scam needs a test that fails without the fix.
4. Run `npm test` and try the change in a browser; describe what you did in the pull request.
5. Update the README, user manual and `CHANGELOG.md` if behaviour changes.

## Not merged without strong discussion
New permissions, network addresses or dependencies; anything that sends browsing data off the device or adds analytics; wording that promises safety; features that read page content.

## Conduct
Be respectful, assume good intent, and disagree with ideas rather than people. Do not post links to live scam sites; give the domain as text. Maintainers may remove comments or block people who ignore this.

## Licence
By contributing you agree your work is licensed under the [MIT licence](LICENSE).
