# Keyboard and tab behavior

Status: unreleased source changes after 1.0.2. These shortcuts work in browser
chrome and focused web pages, including page text fields. They are local to the
browser, not system-wide hotkeys. Native copy/paste, undo/redo, selection and
ordinary typing are left to the focused field.

## Defaults

| Action | Keys |
| --- | --- |
| New tab | Ctrl+T |
| Close tab | Ctrl+W, Ctrl+F4, or middle-click its tab |
| Reopen last closed tab | Ctrl+Shift+T |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab; Ctrl+PageDown / Ctrl+PageUp |
| Select tab 1–8 / last tab | Ctrl+1–8 / Ctrl+9 |
| Address bar | Ctrl+L, Alt+D, Ctrl+K, F6 |
| Reload / bypass cache | Ctrl+R or F5 / Ctrl+Shift+R or Ctrl+F5 |
| Back / forward | Alt+Left / Alt+Right; Ctrl+[ / Ctrl+] |
| Home / stop loading | Alt+Home / Escape |
| Find in page | Ctrl+F |
| Next / previous match | Enter / Shift+Enter in Find; Ctrl+G / Ctrl+Shift+G; F3 / Shift+F3 |
| Zoom in / out / reset | Ctrl+Plus (or Ctrl+=) / Ctrl+- / Ctrl+0 |
| Fullscreen | F11 |
| Print / save page | Ctrl+P / Ctrl+S |
| Page DevTools | F12, Ctrl+Shift+I, Ctrl+Shift+J |
| Close window / quit | Ctrl+Shift+W / Ctrl+Q |
| Settings / guide | Ctrl+, / Ctrl+/ |
| Fingerprint settings | Ctrl+D |
| Device / proxy / interceptor | Ctrl+Shift+M / Ctrl+Shift+P / Ctrl+Alt+I |

On macOS, Command is also accepted for the Ctrl-style letter/number bindings.
Use **Control+Tab** to cycle tabs: Command+Tab belongs to macOS and is not
overridden. OS-reserved shortcuts and function-key settings can take precedence.
Native print dialogs, save dialogs, fullscreen transitions and OS-specific
shortcuts still need manual validation on each packaged target; automated live
keyboard checks currently run on Windows.

Fathi is not claiming every Chrome feature or shortcut. There is no new
multi-window manager, bookmark manager or persistent history/download library
in this change. Ctrl+D remains Fathi's fingerprint settings shortcut. Closing
the last tab retains the existing behavior of opening a fresh private tab;
Ctrl+Shift+W explicitly closes the window.

## Customization

Use Settings → Shortcuts to record, clear, save or reset bindings. Ctrl+Tab and
Ctrl+Shift+Tab can now be recorded. Ordinary Tab / Shift+Tab moves between
fields; Backspace clears a binding and Escape leaves the recorder.

Chrome-style aliases are active only while their action keeps its default
binding. Rebinding or clearing an action disables its aliases. Explicit custom
bindings take precedence, and existing saved bindings are preserved. In
particular, older configurations may still bind Ctrl+Shift+I to the interceptor.
Reset shortcuts (or rebind it) to use Ctrl+Shift+I for DevTools and Ctrl+Alt+I
for interception. The same resolver is used for chrome and webview input.

## Smoother tabs without weakening isolation

- Switching tabs focuses the selected page and keeps its tab visible, without
  animating through intermediate tabs during rapid keyboard switching.
- New blank tabs focus the address bar. Background links stay in the background
  and open next to their originating tab.
- Closing a tab removes it and selects its neighbor immediately; session cleanup
  is still awaited, but does not leave stale tab indexes while input continues.
- Background loads no longer reset the foreground progress indicator. User zoom
  is not reset on every document-ready event. Reduced-motion preferences are
  respected.

Reopening keeps at most **10 URL/device entries in memory**, not on disk, and
creates a **new partition and fingerprint**. It does not restore cookies,
storage, passwords, POST submissions, page form contents or the old identity.
Internal identity/device replacement does not populate the reopen stack. All
entries disappear when the browser closes. Printing, saving a page and copying
diagnostics are explicit user-directed exports, not automatic persistence.

## About diagnostics

About displays the actual host OS name/version/build, machine architecture,
application architecture, Chromium/Electron/Node versions and packaged versus
development status. These values are not the tab's spoofed identity. Both info
APIs use the same collector; no Windows edition is guessed from a kernel number.
Copied diagnostics exclude usernames, hostnames, local paths and browsing data.

## Validation

```sh
npm test
npx electron . --fathi-e2e --fathi-browser-audit --fathi-identity-audit --fathi-intercept-audit
```

The browser audit sends real Electron key events through focused webviews and
chrome. It checks tab navigation from a textarea, numbered tabs, custom guest
bindings, shortcut recording, find matches, zoom, close/reopen with new identity,
background selection and actual About system fields. Unit tests cover all
default/alias resolution, IME/AltGraph safeguards and runtime diagnostics.
