# Identity and isolation audit

Status: unreleased changes following 1.0.2. No release is published by this audit.

## Contract

A new tab and New identity allocate a fresh random profile and a fresh
non-persistent Electron session. Reloading the same tab keeps its identity and
storage stable. Different identities do not require every individual field to
change: two realistic Chrome profiles can share a UA, screen size, or core
count. Identity and noise material must be independently generated instead of
inventing impossible values merely to make every field different.

The generator uses independent cryptographic material for a 128-bit identity
seed and canvas/audio noise. Partition IDs use independent UUIDs. Renderer
supplied profiles are not reused. Profile lists and device GPU data are copied
so mutating one profile cannot change another.

## Findings addressed

- Canvas readout used a parity-only noise pattern and inconsistent seeds across
  read and export APIs. Stable coordinate-based noise now agrees across
  getImageData, PNG export, and OffscreenCanvas, including dedicated workers.
- Audio variation missed OfflineAudioContext results. AudioBuffer reads and
  copyFromChannel now receive stable per-profile perturbations without repeated
  drift. Tiny noise can affect audio applications; the preference can disable it.
- Date timezone-offset sign was reversed and explicit Intl timezones were
  overwritten. Offsets, daylight saving, explicit UTC, and native page timezone
  configuration are now checked.
- Native worker values could race profile installation. Guests initialize on
  about:blank and target navigation waits for native identity and worker hooks.
- Chromium client hints leaked into Safari-shaped profiles, native header
  spellings could coexist with spoofed ones, and Android model hints were empty.
- Chrome versions were randomly invented despite a fixed underlying engine.
  Reported Chromium versions now match the installed engine. Device-memory
  values respect Chromium's 8 GiB reporting cap; Intel Mac GPU profiles use x86.
- Plain arrays replaced PluginArray/MimeTypeArray, and device group IDs
  contained a literal application marker. Native plugin arrays are preserved;
  that marker is removed. OS speech-voice enumeration is minimized.
- Spoofing preferences were not propagated to new profiles. Changes now apply
  to new tabs and New identity, without silently changing an existing profile.
- Proxy setup was not awaited before navigation. Initialization now waits, and
  configured-proxy failures do not silently continue as successful preparation.
- Session teardown retained fingerprint/proxy mappings. Teardown now removes
  those mappings, closes connections and clears auth, storage, cache and DNS
  state before New identity continues.
- Guests cannot create/destroy arbitrary tab sessions or retrieve another
  tab's fingerprint. Only known, non-persistent partitions can attach.
- The extension-install bridge is no longer exposed to arbitrary websites.

## Burp certificate trust

Previously, certificate issuer/subject names containing Burp or PortSwigger
could bypass verification. Names are not proof of trust. That path is removed.

Use Burp now configures the explicit loopback HTTP proxy and retrieves its
public CA from `http://burp/cert` through that proxy. The response must parse as
a currently valid CA certificate. Downloads are bounded to 64 KiB and five
seconds, do not follow redirects, and cannot use a remote or SOCKS proxy for
automatic retrieval. A manual public-certificate import remains available.

Trust is limited to the imported public CA, with signature-chain, validity,
hostname and server-auth usage checks. It only applies while proxy trust and
the proxy itself are enabled. Certificate names alone never suffice. The
public CA persists in proxy preferences; no CA private key is imported or
stored. Nothing is installed into the operating system trust store.

This workflow is tested with a generated local test CA and a loopback proxy
fixture. A live Burp installation is not part of the automated test environment.
Review the locally selected proxy: another process controlling that listener
can supply its own CA when you explicitly retrieve it. Retrieval does not
silently replace an existing pin on startup.

## Validation

`npm test` covers 2,000 independently generated profiles, mutation isolation,
timezone behavior, navigator/prototype agreement, header consistency, scoped
research tools and network history. Certificate tests generate temporary keys
with OpenSSL, test real signatures/hostnames, reject malformed certificates and
exercise the bounded local download. No test private keys are committed.

Run the application audit with:

```bash
npx electron . --fathi-e2e --fathi-identity-audit
```

The local HTTP fixture checks early page scripts, cross-origin frames, workers,
on-wire identity, canvas/audio stability and differences, storage isolation
(cookies, localStorage, IndexedDB and CacheStorage), reload stability, and New
identity teardown. E2E uses temporary preferences. The broader E2E suite also
visits example.com. Runtime checks here are executed locally on Windows; CI
unit checks run on Windows, Linux and macOS. This is not a claim of independent
third-party certification or identical runtime coverage on every platform.

## Important limits

- Fathi remains Chromium. An iOS/Safari profile does not turn it into WebKit;
  CSS behavior, TLS/HTTP transport, fonts, codecs and API implementations can
  reveal the real engine or host. System fonts are not virtualized.
- This is profile emulation and session isolation, not a guarantee that every
  fingerprint surface is covered or that automation cannot be detected.
- Main-world wrappers are observable. Sophisticated pages may detect them.
  Service-worker startup, nested worker chains, worklets and all browser
  extensions are not comprehensively audited by these tests.
- Worker initialization shares the recorder's debugger connection. Opening
  DevTools can detach it; worker protections are not guaranteed while another
  debugger owns the target. Avoid that during privacy-sensitive browsing.
- A new fingerprint does not change a direct public IP, account identity,
  server-side identifiers, downloaded files, exported data or clipboard history.
  Proxy rotation changes only what the configured proxy actually provides.
- WebRTC non-proxied UDP is disabled per guest, but this is not a blanket
  guarantee against every possible network-side correlation channel.

Treat these limits as part of the product contract, not as reasons to label a
profile fully anonymous or undetectable.
