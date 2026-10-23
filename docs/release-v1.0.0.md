# Fathi 1.0.0

The first public release of Fathi, a private desktop browser with a separate
identity in every tab.

## Highlights

- A distinct and consistent fingerprint per tab, covering user agent, screen,
  hardware, WebGL, canvas, audio, timezone, and network details.
- Sessions live in memory. Nothing survives a closed tab or a restart.
- Full request flow capture with export to HAR 1.2, XML, JSON, and CSV.
- Request inspector with timing, size, cache, and security findings.
- Request interception with edit, forward, and drop.
- Code generation for cURL, Python, PHP, Node, PowerShell, Go, and raw HTTP.
- Proxy control per session, with a Burp Suite preset and optional PortSwigger
  certificate trust.
- Device emulation presets that keep the window size and match the viewport.
- Chrome Web Store extension support.
- English and Arabic interface.
- Ten Unsplash wallpapers bundled for offline use.

## Downloads

| Platform | File |
| --- | --- |
| Windows installer | Fathi-Setup-1.0.0.exe |
| Windows portable | Fathi-Portable-1.0.0.exe |
| Linux x64 | Fathi-1.0.0-linux-x64.tar.gz |
| macOS Intel | Fathi-1.0.0-mac-x64.zip |
| Source | fathi-browser-1.0.0-source.zip |

## Notes

The proxy is unset by default. Add an entry under Settings, Proxy when needed.

The Linux archive is a portable directory build. Extract it and run `fathi`.
AppImage and deb packages can be produced on Ubuntu with `npm run dist:linux`.

The Windows and macOS builds are unsigned. SmartScreen or Gatekeeper may show
a warning on first launch.

## About

Fathi is built by [iMumd](https://github.com/iMumd).

- GitHub: [github.com/iMumd](https://github.com/iMumd)
- Telegram: [@aweing](https://t.me/aweing)
- Channel: [Mumdthoughts](https://t.me/Mumdthoughts)
- Email: [hi@mumd.dev](mailto:hi@mumd.dev)

Bundled photography from [Unsplash](https://unsplash.com).
