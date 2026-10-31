# Contributing to Verity

Thanks for helping. Verity is small on purpose, and every change should keep it **explainable, private and low-permission**.

## Good first contributions
- **Report a wrong warning or a missed scam** using the issue templates. This is the most useful thing you can do. Give the domain only, and why you are sure.
- Add or verify entries in `extension/data/brands.json` (especially local brands).
- Improve the docs, or the wording of warnings.
- Add tests for edge cases.

## Getting started
Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). In short: Node 20.12+, `npm test`, load `extension/` unpacked.

## Making a change
1. Open an issue first for anything bigger than a small fix, so we agree on the direction.
2. Branch from `main`.
3. **Write a test.** A fix for a false alarm or a missed scam must include a test that fails without the fix.
4. Keep logic in `extension/src/core/` as pure functions.
5. Run `npm test`. Try the change in a browser and describe what you did in the pull request.
6. Update `docs/` and `CHANGELOG.md` if behaviour changes.

## What will not be merged without strong discussion
- New permissions, new network addresses, new dependencies.
- Anything that sends browsing data off the device, or adds analytics.
- Wording that promises safety ("this site is safe", "protected").
- Features that read page content.

## Commit messages
Short imperative summary (`Fix typo rule for 4-letter names`), details in the body if needed.

## Conduct and security
Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## Licence
By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
