#!/usr/bin/env bash
set -euo pipefail

REPO="iMumd/fathi-browser"
API="https://api.github.com/$REPO/releases/latest"
command -v python3 >/dev/null || { echo 'Python 3 is required to validate release metadata.' >&2; exit 1; }
WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/fathi-update.XXXXXXXX")
STAGE=''
BACKUP=''
INSTDIR=''
SWAPPED=0
cleanup() {
  if [ -n "$BACKUP" ] && [ -d "$BACKUP" ] && [ "$SWAPPED" = 0 ]; then
    if [ -e "$INSTDIR" ]; then sudo mv "$INSTDIR" "$STAGE"; fi
    sudo mv "$BACKUP" "$INSTDIR"
  fi
  if [ -n "$STAGE" ] && [ -d "$STAGE" ]; then sudo rm -rf -- "$STAGE"; fi
  rm -rf -- "$WORKDIR"
}
trap cleanup EXIT
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) PLATFORM=linux; SUFFIX=linux-x64.tar.gz ;;
  Darwin/x86_64) PLATFORM=mac; SUFFIX=mac-x64.zip ;;
  Darwin/arm64) PLATFORM=mac; SUFFIX=mac-arm64.zip ;;
  *) echo 'Unsupported platform or architecture.' >&2; exit 1 ;;
esac

echo '[Fathi Updater] Checking for updates...'
curl -fsSL "$API" -o "$WORKDIR/release.json"
python3 - "$WORKDIR/release.json" "$SUFFIX" > "$WORKDIR/asset" <<'PY'
import json, re, sys
r = json.load(open(sys.argv[1]))
tag = r['tag_name']
if not re.fullmatch(r'v\d+\.\d+\.\d+', tag):
    raise SystemExit('Invalid stable version')
name = 'Fathi-' + tag[1:] + '-' + sys.argv[2]
a = next((a for a in r['assets'] if a['name'] == name), None)
if not a or not re.fullmatch(r'sha256:[a-f0-9]{64}', a.get('digest') or ''):
    raise SystemExit('Release asset or SHA-256 digest is missing')
url = a['browser_download_url']
if not url.startswith('https://github.com/iMumd/fathi-browser/releases/download/' + tag + '/'):
    raise SystemExit('Unexpected download URL')
print(tag); print(url); print(a['digest'][7:])
PY
TAG=$(sed -n '1p' "$WORKDIR/asset")
ASSET=$(sed -n '2p' "$WORKDIR/asset")
DIGEST=$(sed -n '3p' "$WORKDIR/asset")
echo "[Fathi Updater] Latest version: $TAG"
curl -fL --retry 3 "$ASSET" -o "$WORKDIR/archive"
python3 - "$WORKDIR/archive" "$DIGEST" <<'PY'
import hashlib, sys
h = hashlib.sha256()
with open(sys.argv[1], 'rb') as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
if h.hexdigest() != sys.argv[2]: raise SystemExit('Download checksum mismatch')
PY
mkdir "$WORKDIR/unpacked"
if [ "$PLATFORM" = linux ]; then
  tar -xzf "$WORKDIR/archive" -C "$WORKDIR/unpacked"
  SOURCE="$WORKDIR/unpacked/Fathi-${TAG#v}-linux-x64"
  [ -x "$SOURCE/fathi" ] && [ -f "$SOURCE/resources/app.asar" ] || { echo 'Invalid Linux archive' >&2; exit 1; }
  # Check the packaged app version, not the archive filename.
  python3 - "$SOURCE/resources/app.asar" "${TAG#v}" <<'PY'
import json, struct, sys
with open(sys.argv[1], 'rb') as f:
    prefix = f.read(16)
    header_size = struct.unpack_from('<I', prefix, 4)[0]
    json_size = struct.unpack_from('<I', prefix, 12)[0]
    header = json.loads(f.read(json_size))
    entry = header['files']['package.json']
    f.seek(8 + header_size + int(entry['offset']))
    package = json.loads(f.read(entry['size']))
if package['version'] != sys.argv[2]: raise SystemExit('Packaged version does not match release')
PY
  # Never leave an old process holding the single-instance lock.
  python3 - <<'PY'
import os, signal, time
mine = os.getuid()
running = []
for pid in os.listdir('/proc'):
    if not pid.isdigit(): continue
    try:
        path = '/proc/' + pid
        exe = os.readlink(path + '/exe').replace(' (deleted)', '')
        if os.stat(path).st_uid == mine and os.path.basename(exe) == 'fathi':
            running.append(int(pid))
    except (OSError, ValueError): pass
if running: print('[Fathi Updater] Closing Fathi. Unsaved browsing sessions will end.')
for pid in running:
    try: os.kill(pid, signal.SIGTERM)
    except ProcessLookupError: pass
for _ in range(150):
    if not any(os.path.exists('/proc/' + str(pid)) for pid in running): break
    time.sleep(.1)
else: raise SystemExit('Fathi is still running. Close it and retry.')
PY
  INSTDIR=/opt/fathi
  STAGE="/opt/fathi-new-$$"
  BACKUP="/opt/fathi-backup-$$"
  sudo mkdir "$STAGE"
  sudo cp -a "$SOURCE/." "$STAGE/"
  sudo chown -R root:root "$STAGE"
  sudo chmod 4755 "$STAGE/chrome-sandbox"
  if [ -e "$INSTDIR" ]; then sudo mv "$INSTDIR" "$BACKUP"; fi
  sudo mv "$STAGE" "$INSTDIR"
  sudo cmp "$SOURCE/resources/app.asar" "$INSTDIR/resources/app.asar"
  [ -x "$INSTDIR/fathi" ] || { echo 'Installed executable is not runnable' >&2; exit 1; }
  sudo mkdir -p /usr/local/bin /usr/share/applications
  sudo ln -sfn "$INSTDIR/fathi" /usr/local/bin/fathi
  cat > "$WORKDIR/fathi.desktop" <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Fathi
Comment=Private browser with per-tab fingerprints
Exec=/opt/fathi/fathi %U
Icon=/opt/fathi/resources/fathi.png
Terminal=false
Categories=Network;WebBrowser;
StartupWMClass=Fathi
DESKTOP
  sudo cp "$WORKDIR/fathi.desktop" /usr/share/applications/fathi.desktop
  # User launchers override system launchers. Repair Fathi launchers only.
  DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
  python3 - "$WORKDIR/fathi.desktop" "$DESKTOP_DIR" <<'PY'
import os, pathlib, shutil, sys
source = pathlib.Path(sys.argv[1])
apps = pathlib.Path(os.environ.get('XDG_DATA_HOME', str(pathlib.Path.home() / '.local/share'))) / 'applications'
apps.mkdir(parents=True, exist_ok=True)
for folder in (apps, pathlib.Path(sys.argv[2])):
    for p in folder.glob('*.desktop'):
        try:
            if 'Name=Fathi' in p.read_text().splitlines(): shutil.copyfile(source, p)
        except (OSError, UnicodeError): pass
shutil.copyfile(source, apps / 'fathi.desktop')
PY
  command -v update-desktop-database >/dev/null && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
else
  ditto -x -k "$WORKDIR/archive" "$WORKDIR/unpacked"
  SOURCE="$WORKDIR/unpacked/Fathi.app"
  VERSION=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$SOURCE/Contents/Info.plist")
  [ "$VERSION" = "${TAG#v}" ] || { echo 'Packaged version does not match release' >&2; exit 1; }
  [ -x "$SOURCE/Contents/MacOS/Fathi" ] || { echo 'Invalid macOS archive' >&2; exit 1; }
  osascript -e 'tell application "Fathi" to quit' 2>/dev/null || true
  if pgrep -x Fathi >/dev/null; then echo 'Close Fathi completely and retry.' >&2; exit 1; fi
  INSTDIR=/Applications/Fathi.app
  STAGE="/Applications/.Fathi-new-$$.app"
  BACKUP="/Applications/.Fathi-backup-$$.app"
  sudo ditto "$SOURCE" "$STAGE"
  if [ -e "$INSTDIR" ]; then sudo mv "$INSTDIR" "$BACKUP"; fi
  sudo mv "$STAGE" "$INSTDIR"
  [ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$INSTDIR/Contents/Info.plist")" = "${TAG#v}" ]
  echo '[Fathi Updater] Open /Applications/Fathi.app. Unsigned builds may require approval in Privacy & Security.'
fi
SWAPPED=1
if [ -d "$BACKUP" ]; then sudo rm -rf -- "$BACKUP"; fi
echo "[Fathi Updater] Installed and verified $TAG at $INSTDIR. Existing preferences are preserved."
