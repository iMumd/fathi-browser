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

```bash
curl -fsSL https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh | bash
```

Paste the command exactly as shown. Do not add `bash` before `curl`; the script is
already piped into `bash`. The script asks for your sudo password, downloads the
latest Linux archive, and installs it to `/opt/fathi`.
Python 3 is required. The updater verifies the download checksum and packaged
version before replacing files. It closes running Fathi processes, preserves
preferences, and repairs application-menu and desktop launchers to use
`/opt/fathi/fathi`. Save your work first. Run `fathi` or use the repaired shortcut
afterward, not an older executable in a manually extracted folder.

To read the script before running it:

```bash
curl -fsSLO https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh
less update-fathi.sh
bash update-fathi.sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.ps1 | iex
```

The updater verifies the checksum, waits for installation to finish, and checks
the installed version. An existing installation directory is reused. Close Fathi
before running the command and approve elevation if Windows requests it.

For a portable copy, point to the original executable, not its temporary
extraction directory:

```powershell
$env:FATHI_PORTABLE_PATH = 'C:\Tools\Fathi-Portable.exe'
irm https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.ps1 | iex
```

### macOS (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh | bash
```

Python 3 is required. The updater selects Intel or Apple Silicon, verifies the
checksum and application version, and replaces `/Applications/Fathi.app` while
preserving preferences. Unsigned builds may need approval in Privacy & Security.
Windows installed builds support in-app installation; Linux, portable Windows,
and unsigned macOS builds offer the appropriate update command instead.

New releases show an update banner. The first launch of each installed version
also shows a short What's New page once. Update metadata (`latest*.yml`) and
blockmaps are release support files, not additional installers.

You can also download the latest release manually from [GitHub Releases](https://github.com/iMumd/fathi-browser/releases). The app also checks for updates on launch.

