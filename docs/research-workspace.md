# Research workspace

Status: unreleased source changes. No new version is published for this work.

## Scope

Open Settings > Research. Enter hostnames, one per line, in Include hosts and
Exclude hosts. Exclusions take precedence.

```text
example.com
*.example.com
```

The first line includes the root domain. The second includes subdomains, not
the root. Matching respects DNS boundaries: `evil-example.com` does not match
`example.com`. IP literals, including bracketed IPv6, are accepted. Paths,
schemes, ports, arbitrary wildcards, and regexes are not accepted.

Apply scope, then use In scope in Flow. Optionally select Pause only in-scope
requests to narrow interception. Empty include lists cannot enable that mode.
Scope does not block navigation, change proxy routing, constrain replay, or
restrict Match and Replace. It is a research aid, not an authorization boundary.
No scope is saved to disk; it resets on exit.

## Offline toolbox

The toolbox provides UTF-8/Base64 conversion, URL component encoding and
decoding, JSON formatting, JWT inspection, and SHA-256. Input is limited to
65,536 JavaScript characters. Binary/non-UTF-8 Base64 is rejected rather than
silently corrupted. URL decoding does not treat `+` as a space; it is not a
form-urlencoded parser.

JWT inspection always reports `signatureVerified: false`. It does not fetch
keys, validate signatures, enforce expiration, or establish trust in claims.
No operation sends input over the network. Input and output stay in memory
until cleared or the application exits. Copying output puts it on the system
clipboard, which may have its own history.

## Security notes

Open a captured Flow request and select Security notes. Observations use the
captured response headers, not active requests or external scanners.

Checks cover plaintext transport, document CSP and framing headers, nosniff,
positive HSTS max-age, selected cookie attributes, a wildcard/credentials CORS
configuration, and technology-disclosure headers. Cookie evidence contains
names only, not values. Resource context is considered to reduce irrelevant
missing-header warnings for non-document responses.

The labels Review, Hardening, and Context are triage aids, not CVSS ratings.
Browser defaults, parent-domain HSTS, preload lists, meta-delivered CSP, and
application intent can affect interpretation. A wildcard CORS policy with
credentials is rejected by browsers; it is not by itself a credential-leak
finding. Absence of observations does not establish security.

## Comparison

In a Flow detail view, select Pin as baseline. Open another response and select
Compare. The panel shows status changes, case-insensitive response-header
differences, and the changed body segment after removing a common prefix and
suffix. It is not a line-by-line diff or a binary comparer.

The changed segment preview is limited to 8,192 characters per side. Captured
body truncation or unavailable bodies are explicitly reported. Comparison data
remains in memory. Closing the source tab, clearing its Flow history, clearing
all history, or selecting Clear baseline removes the baseline.

## Filtered exports

Method, status, text, and in-scope filters narrow both the list and saved
exports. Exports include matching records held in the current Flow view, not
only the last 500 rows rendered on screen. The view retains at most 1,500
summaries. Raw HAR, XML, JSON, and CSV exports require confirmation because they
can contain credentials or personal data. CSV protects text cells from common
spreadsheet formula prefixes.

Redacted JSON uses a strict allowlist of record fields. It removes bodies,
error strings, URL userinfo/path/query/fragment, and every header value.
Hostnames, header names, method, status, resource type, MIME type, and transfer
size remain. Review the result before sharing; this is not anonymization.

## Design references and decisions

Reviewed 29 October 2026. These are workflow references, not copied code or
claims of feature parity:

- [Burp's browser](https://portswigger.net/burp/documentation/desktop/tools/burps-browser): integrated capture and deliberate manual testing.
- [Burp target scope](https://portswigger.net/burp/documentation/desktop/tools/target/scope): reduce noise and make target selection explicit.
- [ZAP passive scanning](https://www.zaproxy.org/docs/desktop/start/features/pscan/): analyze existing traffic without generating attack traffic.
- [ZAP scope](https://www.zaproxy.org/docs/desktop/start/features/scope/): nothing is in scope until explicitly included.
- [Caido scopes](https://docs.caido.io/app/guides/scopes_defining): clear include/exclude lists.
- [Caido JWT workflow](https://docs.caido.io/app/tutorials/decode_jwt): local data inspection as a small composable task.
- [Firefox Network Monitor](https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/request_details/): compact request details and contextual security information.

Visual direction: restrained information density, flat surfaces, type hierarchy,
theme tokens, and explicit labels. About presents the product, its principles,
the developer, and safe diagnostics without gradients, decorative charts, or
oversized controls. Dark/light and English/Arabic are checked in the app.

Deferred intentionally: automatic fuzzing, active vulnerability scanning,
arbitrary shell workflows, and persistent projects. Those require separate
threat modeling and explicit product decisions, not silent additions.
