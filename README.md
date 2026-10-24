![Fathi](docs/banner.png)

# Fathi

A private desktop browser with a separate and coherent fingerprint in every tab.
Built on Electron and Chromium for Windows, Ubuntu, and macOS.

## Download

The latest release contains a Windows installer, a Windows portable build, a
Linux archive, a macOS build, and the full source.

[Releases](https://github.com/iMumd/fathi-browser/releases)

## What it does

- A fresh identity for each tab. User agent, screen metrics, hardware, WebGL,
  canvas, audio, timezone, and network details stay consistent inside the tab
  and never carry over to the next one.
- Incognito by default. Sessions live in memory and are destroyed when a tab
  closes.
- Request and response capture with export to HAR, XML, JSON, and CSV.
- Any captured request can be copied as cURL, Python, PHP, Node, PowerShell,
  Go, or raw HTTP.
- Proxy configuration for each tab, with a Burp Suite preset.
- Device emulation that matches user agent, viewport, screen, pixel ratio,
  touch, and platform.
- Chrome Web Store extensions.
- English and Arabic interface.
- Unsplash wallpapers shipped with the app.

## Build

Requirements: Node.js 20 or newer.

```
npm install
npm start
```

Windows:

```
npm run dist:win
```

Linux:

```
npm run dist:linux
```

macOS:

```
npm run dist:mac
```

Release builds for all three platforms are produced by GitHub Actions when a
version tag is pushed.

## Privacy

Fathi keeps no history, cache, or cookies after a tab or the app closes. Only
`fathi-config.json` is stored, and it holds preferences alone. Network capture
stays in memory until you export it.

## About

Fathi is an independent project by [iMumd](https://github.com/iMumd), focused
on private browsing, fingerprint research, and request inspection.

- GitHub: [github.com/iMumd](https://github.com/iMumd)
- Telegram: [@aweing](https://t.me/aweing)
- Channel: [Mumdthoughts](https://t.me/Mumdthoughts)
- Email: [hi@mumd.dev](mailto:hi@mumd.dev)

Bundled photography from [Unsplash](https://unsplash.com).

## License

MIT. See [LICENSE](LICENSE).

## Updates

### Linux (one command)

`ash
curl -fsSL https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh | bash
`

### Windows (PowerShell as Administrator)

`powershell
irm https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.ps1 | iex
`

You can also download the latest release manually from [GitHub Releases](https://github.com/iMumd/fathi-browser/releases). The app also checks for updates on launch.

