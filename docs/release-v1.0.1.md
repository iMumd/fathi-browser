# Fathi 1.0.1

Fathi 1.0.1 focuses on stability, a faster interceptor, and support for
anonymous networks.

## Highlights

- Tor routing for `.onion`, `.eth`, and `.i2p` addresses through a local SOCKS5
  listener. Every other request still uses the normal connection or the
  configured proxy pool.
- Automatic update checks against GitHub Releases, with an explicit prompt
  before download and restart.
- One command updaters for Linux and Windows, documented in the README.
- Burp-style Match and Replace rules for request headers, request bodies,
  response headers, and response bodies, with regular expression support.
- Repeat in the interceptor: resend an edited request with the original headers
  and inspect the response in place.
- The interceptor now searches the full URL, headers, and request body, filters
  results live, and shows a readable request name for every entry.
- Structured header editing, pretty-printed JSON, and improved forward and drop
  controls.
- Customizable keyboard shortcuts with conflict detection, a shortcuts page in
  settings, and a guide reachable from the new tab page.
- Application menu in the titlebar with exit and app options.
- Tor settings card in the proxy section, including the SOCKS5 port and a
  listener check.

## Fixes

- Linux and Windows titlebar icons for minimize, maximize, and close now respond
  to clicks.
- The new tab button is responsive again.
- Intermittent white pages, freezes, and device emulation stalls are resolved.
- DevTools no longer hangs while docking or resizing the window.
- Device emulation uses native emulation and keeps the viewport accurate.

## Downloads

| Platform | File |
| --- | --- |
| Windows installer | Fathi-Setup-1.0.1.exe |
| Windows portable | Fathi-Portable-1.0.1.exe |
| Linux x64 | Fathi-1.0.1-linux-x64.tar.gz |
| macOS Intel | Fathi-1.0.1-mac-x64.zip |
| macOS Apple Silicon | Fathi-1.0.1-mac-arm64.zip |

## Notes

The proxy is unset by default. Add an entry under Settings, Proxy when needed.

Tor routing is enabled by default and expects a local Tor SOCKS5 listener on
port 9050. Tor Browser users can switch the port to 9150. Only special-use
domains are sent through Tor.

The Linux archive is a portable directory build. Extract it and run `fathi`.

The Windows and macOS builds are unsigned. SmartScreen or Gatekeeper may show a
warning on first launch.

## About

Fathi is built by [iMumd](https://github.com/iMumd).

- GitHub: [github.com/iMumd](https://github.com/iMumd)
- Telegram: [@aweing](https://t.me/aweing)
- Channel: [Mumdthoughts](https://t.me/Mumdthoughts)
- Email: [hi@mumd.dev](mailto:hi@mumd.dev)

Bundled photography from [Unsplash](https://unsplash.com).
