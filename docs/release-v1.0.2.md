# Fathi 1.0.2

## Interface and testing

- Larger Use Burp button and theme-aware SOCKS port input.
- Collapse and expand individual Match and Replace rules.
- Test your own header value or body against current rules before saving. Results
  use the live replacement engine without sending a network request. Regex
  previews run in a worker with a timeout.
- Consistent keyboard shortcut sizes, alignment, focus indicators, and reset.

## Mobile presets

- Align the native emulated viewport with the phone frame.
- Avoid repeated emulation configuration and debounce window resizing.

## Updates

- Notify when a newer version is available, including after an earlier check
  reported the current version as latest.
- Show What's New once on first launch of each installed version.
- Verify command-line downloads with SHA-256 and validate the packaged version.
- Linux: staged replacement, old-process shutdown, repaired desktop launchers,
  preserved preferences, and rollback on installation failure.
- Windows: deterministic installer selection, reuse the installed directory,
  wait for completion, verify the resulting version, and support explicit
  portable-file replacement.
- macOS: architecture-aware replacement of `/Applications/Fathi.app`.

## Downloads

| Platform | File |
| --- | --- |
| Windows installer | [Fathi-Setup-1.0.2.exe](https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-Setup-1.0.2.exe) |
| Windows portable | [Fathi-Portable-1.0.2.exe](https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-Portable-1.0.2.exe) |
| Linux x64 | [Fathi-1.0.2-linux-x64.tar.gz](https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-1.0.2-linux-x64.tar.gz) |
| macOS Intel | [Fathi-1.0.2-mac-x64.zip](https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-1.0.2-mac-x64.zip) |
| macOS Apple Silicon | [Fathi-1.0.2-mac-arm64.zip](https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-1.0.2-mac-arm64.zip) |

Save your browsing work before updating. Unsigned macOS builds may require
approval in Privacy & Security. Metadata and blockmaps support the updater and
should remain in the release assets.
