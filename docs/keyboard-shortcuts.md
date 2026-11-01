# Keyboard and private browser controls

Status: unreleased source changes after 1.0.2. Shortcuts work in browser chrome
and focused pages, including text fields. They are not system-wide hooks.
The profile was checked against [Chrome's desktop shortcut reference](https://support.google.com/chrome/answer/157179?hl=en).
Fathi implements equivalents where it has the feature; it is not a Chrome clone.

## Windows and Linux defaults

| Action | Keys |
| --- | --- |
| New private window | Ctrl+N or Ctrl+Shift+N |
| New tab / reopen closed tab | Ctrl+T / Ctrl+Shift+T |
| Close tab / window | Ctrl+W or Ctrl+F4 / Ctrl+Shift+W |
| Next / previous tab | Ctrl+Tab or Ctrl+PageDown / Ctrl+Shift+Tab or Ctrl+PageUp |
| Move tab right / left | Ctrl+Shift+PageDown / Ctrl+Shift+PageUp |
| Select tab 1–8 / last tab | Ctrl+1–8 / Ctrl+9 |
| Search open tabs | Ctrl+Shift+A |
| Address bar / explicit search | Ctrl+L or Alt+D / Ctrl+K or Ctrl+E |
| Next / previous browser area | F6 / Shift+F6 |
| Page / first enabled toolbar item / last toolbar item | Ctrl+F6 / Alt+Shift+T / F10 |
| Bookmarks bar / open dialog focus | Alt+Shift+B / Alt+Shift+A |
| Browser menu | Alt+F or Alt+E; arrow keys navigate, Escape dismisses, X quits this instance |
| Back / forward / home | Alt+Left / Alt+Right / Alt+Home |
| Reload / bypass cache | Ctrl+R or F5 / Ctrl+Shift+R, Shift+F5 or Ctrl+F5 |
| Stop loading / dismiss | Escape |
| Find / next / previous match | Ctrl+F / Ctrl+G or F3 / Ctrl+Shift+G or Shift+F3 |
| Find selected text | Ctrl+Alt+E |
| Find-bar next / previous match | Enter / Shift+Enter |
| Bookmark current page / all open tabs | Ctrl+D / Ctrl+Shift+D |
| Bookmark manager / bar visibility | Ctrl+Shift+O / Ctrl+Shift+B |
| History / downloads / task metrics | Ctrl+H / Ctrl+J / Shift+Escape |
| Clear session data options | Ctrl+Shift+Delete |
| View source / inspect page | Ctrl+U / Ctrl+Shift+C |
| Page DevTools | F12, Ctrl+Shift+I or Ctrl+Shift+J |
| Open local file / save page | Ctrl+O / Ctrl+S |
| Print dialog | Ctrl+P or Ctrl+Shift+P |
| Zoom in / out / reset | Ctrl+Plus or Ctrl+= / Ctrl+- / Ctrl+0 |
| Fullscreen | F11 |
| Settings / guide | Ctrl+, / Ctrl+/ or F1 |
| Fingerprint / device / proxy / interception | Ctrl+Alt+D / Ctrl+Alt+M / Ctrl+Alt+P / Ctrl+Alt+I |
| Quit this window's application instance | Ctrl+Q |

In the address bar, **Alt+Enter** opens the input in a new foreground tab;
**Ctrl+Enter** completes a bare site name to `https://www.<name>.com`. A leading
`?` forces a search rather than URL navigation. Native page/text controls keep
Tab/Shift+Tab, Space/Shift+Space, Home/End, page scrolling, word navigation,
selection, copy/paste and undo/redo. Non-Latin physical letter keys are normalized
for browser commands; IME composition and AltGraph typing are not intercepted.

## macOS

Command is accepted for the common letter/number bindings. Use **Control+Tab**
to cycle tabs; Command+Tab belongs to macOS. Additional Command aliases include
Y for history, Shift+J for downloads, Option+B for bookmarks, Option+U for source,
Option+I/J for DevTools, Shift+H for home, Option+F for search, and E for finding
selected text. Command+Left/Right navigates history; Option+Left/Right remains
native text navigation. Command+H/M is left to the native hide/minimize handling.
Control+Command+F is an additional fullscreen shortcut.

OS-reserved gestures, function-key settings and native dialogs can take
precedence. Automated live keyboard tests run on Windows; native printing,
file pickers and packaged macOS/Linux GUI behavior still require manual checks.

## New-tab focus

New blank tabs, explicit `fathi://newtab` URLs, the plus button and Fathi's new-tab
button focus the **top address/search bar**. Foreground creation dismisses panels
that would cover it. Focus happens before asynchronous session/proxy setup and
text typed immediately is preserved. Page readiness does not reselect or erase
that text. Background tabs do not steal focus.

## Private feature semantics

- **Windows:** Ctrl+N and Ctrl+Shift+N launch real, independent application
  processes, each with its own window, temporary directories, tab sessions and
  fingerprint maps. All Fathi windows are private; there is no persistent normal
  mode. Configuration is shared on disk but not live-synchronized. Quitting one
  instance does not terminate the other windows. Cross-window tab dragging is
  not implemented.
- **Bookmarks:** up to 200 deduplicated HTTP(S) bookmarks in memory, with a bar,
  manager and removal controls. Bookmark-all uses a flat session collection,
  not a persistent folder. These disappear on window close.
- **History:** up to 300 in-memory HTTP(S) visits for the current window. Internal
  pages, executable URL schemes and local file paths are not recorded here.
- **Downloads:** up to 100 tracked records with native progress, active
  pause/resume/cancel, and completed-file reveal/save-copy controls. Files use
  unique names in the temporary download directory and are wiped on exit.
  Only an explicit Save a copy action exports them outside it. Records expose no
  local paths to the renderer; downloads are never executed automatically.
- **Task manager:** read-only process CPU/memory metrics for this instance, not
  an arbitrary PID termination interface.
- **Clear data:** opens a confirmation panel; the shortcut alone deletes
  nothing. The button clears this window's history, cookies, storage, auth and
  cache. It retains bookmarks and does not affect independent windows. Reload a
  page to reset data already held in its JavaScript memory.
- **Source/inspection:** source uses Chromium's actual `view-source:` viewer in
  a fresh isolated tab, so authenticated pages may require signing in again.
  Inspect opens DevTools at the top-left page element; it is not a promise of
  Chrome's interactive element-picker or exact console-panel selection.

Closing the last tab still opens a fresh private tab. Reopen keeps at most
10 URL/device entries in memory and always creates a new partition/fingerprint;
it does not restore cookies, passwords, POST data, forms or the old identity.
Printing, saving, copying and file selection are explicit user-directed actions.

## Customization and compatibility

Settings → Shortcuts supports recording, clearing, saving and reset. Tab and
Shift+Tab move between recorder fields; Ctrl+Tab can be captured; Backspace
clears and Escape leaves the recorder. Rebinding/clearing disables that action's
aliases. Explicit custom bindings take precedence.

Known shipped legacy bindings migrate once to free Ctrl+D for bookmarks,
Ctrl+Shift+P for printing and Ctrl+Shift+I for DevTools. Distinct custom bindings
and already-versioned profiles are preserved. If a custom binding already claims
the migration's target, it is not overwritten; resolve the conflict or reset the
profile deliberately. Only configuration is persisted, never the session library.

Google accounts/guest profiles, sync, password/payment management, Chrome-only
feedback services, tab groups/multi-selection, split view, caret-browsing controls
and address predictions are not implemented or mapped to unrelated actions.
This is broad desktop shortcut coverage, **not every feature in Chrome**.

## Validation

```sh
npm test
npx electron . --fathi-e2e --fathi-browser-audit --fathi-identity-audit --fathi-intercept-audit
```

The live audit uses real key/mouse input and isolated local fixtures. It opens
and closes actual additional browser processes, reads a completed download,
checks source viewing, clears actual session storage, verifies immediate typing
and new-tab buttons, and exercises tab movement and library shortcuts. Unit
tests cover default/alias/platform matching, migration, library caps, download
state and safe window launch construction. Existing identity and interception
audits remain enabled.
