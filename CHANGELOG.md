# Changelog

## Unreleased

- Fall back to public GitHub release metadata when the API is unavailable;
  command-line updates still require GitHub's SHA-256 digest before replacing files.
- Audit profile entropy, canvas/audio consistency, timezone semantics, native
  worker initialization, header coherence and storage teardown.
- Await proxy setup before target navigation and reject cross-tab identity access.
- Replace certificate-name trust with verified public-CA pinning; automatically
  retrieve Burp's public CA through the explicitly selected local HTTP proxy.
- Move interception actions above the request editor and keep them visible
  while scrolling; place Forward all beside the interceptor toggle.
- Add a session-only research workspace with include/exclude target scope and
  optional in-scope interception.
- Add an offline UTF-8, Base64, URL, JSON, JWT, and SHA-256 toolbox.
- Add contextual passive response observations with evidence and limitations.
- Compare captured response status, headers, and changed body segments.
- Filter Flow by method, status, and target scope; export matching records.
- Add redacted JSON exports and raw-export warnings; guard CSV formula cells.
- Fix stale live request summaries, redirect history, and recorder accounting.
- Refresh About with flat product principles and non-sensitive diagnostics.
- Reorganize documentation and expand pull-request CI across three platforms.

## 1.0.2

- Improve Burp, SOCKS port, rule collapse, and keyboard shortcut controls.
- Preview user-provided payloads with the live rule engine in a timeout worker.
- Align mobile frames and avoid repeated native emulation calls.
- Restore update notifications for newly available versions.
- Show release highlights once per installed version.
- Verify update downloads and actual replacements on Linux, Windows, and macOS.

## 1.0.0

First public release.

- Independent fingerprint for every tab
- In memory sessions with no persistent history
- Request flow capture with HAR, XML, JSON, and CSV export
- In browser interception with edit, forward, and drop
- Request code generation for eight formats
- Per session proxy with a Burp Suite preset
- Device emulation presets
- Chrome Web Store extensions
- English and Arabic interface
- Offline Unsplash wallpapers
