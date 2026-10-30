# Interception and live rules

Status: unreleased source changes after 1.0.2.

## Queue and editor

With Intercept enabled, the first matching request opens automatically. The
pending queue stays visible above the editor and scrolls independently. Select
another request without forwarding the current one; URL, method, header rows,
body and selected editor view are retained as an in-memory draft.

Forward, Drop and Repeat stay above the editor and remain visible while it
scrolls. Forward sends the selected edits. Drop aborts the selected request
without sending it to the target. Resolving a request selects the next queued
request. Forward all submits the current queue snapshot with saved drafts.
Failed sends retain the pause rather than removing it from the UI.

The interceptor filter affects future pause decisions. It does not hide
already-paused requests. Pauses from different tabs have distinct IDs, even if
Chromium reuses a Fetch request ID. Closed/detached targets and expired pauses
are removed from the UI. Drafts are never written to disk.

Safety limits: at most 80 pending requests and a two-minute pause deadline.
Timeout or turning Intercept off forwards the backend's initially rewritten
request, not an unsent frontend draft. Use Forward or Forward all to explicitly
send edits. This avoids leaving a tab frozen indefinitely.

## Rules in real traffic

Request headers, request bodies, response headers and response bodies are
tested against a local HTTP server, not just through the preview UI. Header
rules are applied once through the session request hooks. Body rules use the
existing shared Fetch debugger connection and remain enabled when manual
interception is off. Response pauses are recognized from the actual
`Fetch.requestPaused` event with response metadata.

- Header rules match **header values**, not entire raw header lines or names.
  Use the structured interception editor to rename, add or remove headers.
- Rules run in their saved order. Disabled rules do not run.
- Plain-text replacement treats `$1` and other dollar sequences literally.
  Regex replacement supports JavaScript capture-group syntax.
- Repeated response headers, especially Set-Cookie, remain separate values.
- Body changes update length/encoding metadata and remove stale entity hashes.
  Modified response text is delivered as UTF-8. CSP and application-level
  integrity protections are not silently removed.
- The manual request editor starts with request-body rule output. Forward
  sends that output or your edits once, rather than applying it again.

## Bounds and unsupported cases

Live processing uses at most two worker threads, a queue of 32 waiting jobs,
and a 1.5-second execution timeout per job. Up to 100 rules can be saved; match
patterns are limited to 4,096 characters and replacements to 65,536. Invalid
regexes are rejected on save.

Body-rule input is limited to 64 KiB of UTF-8 text. Large, binary or unavailable
upload bodies, HEAD responses, redirects, empty responses and partial-content
responses are not rewritten. Only supported textual response MIME types are
processed. CDP may obtain an unknown-length response before the decoded size
can be checked; this is not a streaming or general binary rewrite engine.

If a worker times out, the queue is full, or input cannot be processed safely,
traffic continues unchanged and the UI reports a rate-limited warning. Do not
use Match and Replace as an enforced data-loss prevention or network-security
boundary. DevTools can detach the shared debugger and disrupt body rewriting;
closing it reconfigures the Fetch hooks.

## Repeat

Repeat sends the editor's current request through its source tab's session,
including that session's proxy, cookies, identity headers and pinned CA trust.
There is no unconfigured direct-network fallback. It has a 15-second timeout
and a 512 KiB response preview cap. Redirects are reported but not followed
automatically. Request-body edits already shown in the editor are sent as-is.

## Reproduce the checks

```bash
npm test
npx electron . --fathi-e2e --fathi-identity-audit --fathi-intercept-audit
```

The local live-rule fixture checks all four targets with non-idempotent plain
replacements and regex capture groups, both automatic processing and manual
forwarding, separate cookies, source-session replay, redirects, and a
three-request queue with saved drafts and dropped requests. Unit tests also
exercise worker timeouts, equal IDs across tabs, failed continuation and UTF-8
response-length correction. Passing these cases is not a promise that every
protocol, site, payload size, or external network condition is supported.
