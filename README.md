<img src="assets/icon-128.png" width="56" height="56" alt="Fathi" />

# Fathi

A private browser for deliberate security research.

Separate tab identities. Inspectable traffic. Local tools that keep you in control.
Built with Electron and Chromium for Windows, Linux, and macOS.

[Download](https://github.com/iMumd/fathi-browser/releases/latest) ·
[Research guide](docs/research-workspace.md) ·
[Identity audit](docs/identity-audit.md) ·
[Contribute](CONTRIBUTING.md) ·
[Changelog](CHANGELOG.md)

## A focused workspace

| Browse | Inspect | Research |
| --- | --- | --- |
| In-memory tab sessions | Request and response capture | Session-only target scope |
| Per-tab fingerprint profiles | Editable interception and replay | Passive response observations |
| Mobile device presets | Match and Replace with payload tests | Response comparison |
| Burp proxy preset | HAR, XML, JSON, and CSV exports | Offline encoding, JWT inspection, and SHA-256 |

The research workspace, comparison, filtered/redacted exports, and refreshed
About interface are **unreleased source changes**. The published release is
still **1.0.2**. Updating a released installation does not install unreleased code.

### A practical workflow

1. Open a target you are authorized to test. Each tab gets a separate session.
2. Configure your proxy, or select **Use Burp** for the local Burp preset.
3. Open **Research** in Settings and define included and excluded hosts.
4. Open **Flow** to filter traffic, inspect headers, and review security notes.
5. Pin one response as a baseline, open another, and select **Compare**.
6. Export only the filtered records. Use **Redacted JSON** when sharing context.

Research tools do not automatically crawl, scan, or attack targets. Passive
notes do not issue extra requests and are not confirmed vulnerability reports.
JWT inspection decodes claims; it does not verify their signature.

Use Burp also retrieves and validates the public CA from the local Burp listener
and pins it inside Fathi. No system-wide certificate installation is performed.
If retrieval fails, open Burp and retry Retrieve local Burp CA, or import its
public certificate manually. Remote proxy CAs are never fetched automatically.

## Privacy, with clear boundaries

- Browsing sessions, captured traffic, scope, toolbox input, and comparison
  baselines stay in memory. Closing a tab removes its captured traffic and any
  baseline pinned from it; exiting clears the research workspace.
- Preferences are stored in `fathi-config.json`. User-configured proxy details
  can be sensitive. No proxy credentials are bundled.
- Exports, downloads, and clipboard contents are explicit exceptions. They can
  outlive a session and are your responsibility to review and remove.
- Redacted exports omit URL credentials, paths, queries, fragments, header
  values, and bodies. Hostnames, header names, and traffic metadata remain.
  Redaction is not anonymization.
- Fingerprint profiles are research tools, not a guarantee of anonymity,
  undetectability, or protection from every form of tracking.

## Install and update

Use the [latest release](https://github.com/iMumd/fathi-browser/releases/latest).
Windows offers an installer and a portable executable. Linux offers an x64
archive. macOS offers Intel and Apple Silicon archives.

Save your browsing work before running an updater. Commands install the latest
**published** release, verify its download checksum and version, and preserve
preferences. Windows installed builds also support in-app installation.
If GitHub's API is unavailable, the updater uses the public release page and
asset digests instead. It never skips checksum verification to work around a
network failure. If both sources fail, no installation is changed.

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh | bash
```

Requires Python 3 and sudo. Installs to `/opt/fathi`, closes old Fathi processes,
and repairs application-menu and desktop launchers. Launch with `fathi` afterward,
not an older executable from a manually extracted directory. Paste the command
as shown; do not put `bash` before `curl`.

### Windows

```powershell
irm https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.ps1 | iex
```

Reuses an existing installed directory, waits for the installer, and verifies
the installed version. Close Fathi first and approve elevation if requested.

For a portable copy, specify the original executable:

```powershell
$env:FATHI_PORTABLE_PATH = 'C:\Tools\Fathi-Portable.exe'
irm https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.ps1 | iex
```

### macOS

```bash
curl -fsSL https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh | bash
```

Requires Python 3. Selects the host architecture and replaces
`/Applications/Fathi.app`. Unsigned builds may require approval in Privacy & Security.

<details>
<summary>Inspect the script before running it</summary>

```bash
curl -fsSLO https://raw.githubusercontent.com/iMumd/fathi-browser/main/tools/update-fathi.sh
less update-fathi.sh
bash update-fathi.sh
```

For Windows, download and review `tools/update-fathi.ps1` before executing it.
Only run scripts you trust.

</details>

Release assets also include `latest*.yml` and blockmaps for updater support.
These are not extra installers. Fathi checks for updates and shows release
highlights once on first launch of each installed version.

## Develop

Use Node.js 22 or newer.

```bash
npm ci
npm test
npm start
```

| Build | Command |
| --- | --- |
| Windows | `npm run dist:win` |
| Linux | `npm run dist:linux` |
| macOS | `npm run dist:mac` |

Build on the corresponding operating system. Pull requests run tests on all
three platforms. Release builds are separate and only triggered by version tags.
See [CONTRIBUTING.md](CONTRIBUTING.md) for E2E checks and review conventions.

## Independent by design

Created by [iMumd](https://github.com/iMumd), for private browsing, fingerprint
research, and request inspection.

[GitHub](https://github.com/iMumd) · [Telegram](https://t.me/aweing) ·
[Mumdthoughts](https://t.me/Mumdthoughts) · [Email](mailto:hi@mumd.dev)

Bundled photography from [Unsplash](https://unsplash.com).
Security reports: [SECURITY.md](SECURITY.md). Licensed under [MIT](LICENSE).
