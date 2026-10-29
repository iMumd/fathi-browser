# Contributing

Fathi favors small, reviewable changes with clear privacy boundaries.

## Development

Use Node.js 22 or newer. Run `npm ci`, `npm test`, then `npm start`.
For application checks, run `npx electron . --fathi-e2e`. The E2E harness uses a
temporary configuration and writes ignored reports and captures in the project
root. It currently visits example.com, so network-dependent checks can fail
offline. Do not attach raw traffic or sensitive screenshots to issues.

## Pull requests

1. Branch from current `main` with a descriptive `feat/`, `fix/`, or `docs/` name.
2. Keep commits focused. Add regression tests with behavior changes.
3. Update `CHANGELOG.md` under Unreleased and document limits honestly.
4. Open a pull request describing implementation, privacy impact, and validation.
5. Review the complete diff and wait for all platform checks before merging.

Do not bump versions, push release tags, or replace published assets as part of
ordinary feature work. Releases are separately planned. A self-reviewed pull
request should say so rather than imply an independent review.

## Interface

Keep surfaces flat and quiet. Reuse theme tokens, consistent control heights,
modest borders, and visible focus states. Test dark/light themes and English/
Arabic layouts. Do not communicate meaning with color alone. Render captured
traffic and user input as text, never trusted markup.

## Privacy and security

Keep browsing data, target scopes, payloads, and comparison baselines in memory.
Persistence must be explicit and documented. Offline tools must not send input
to remote services. Do not add proxy credentials or private release tooling.
Distinguish observations from confirmed vulnerabilities. See [SECURITY.md](SECURITY.md)
for vulnerability reporting.
