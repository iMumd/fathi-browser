#!/usr/bin/env bash
# Integration test: only run on an ephemeral GitHub-hosted Linux runner.
set -euo pipefail
[ "${GITHUB_ACTIONS:-}" = true ] && [ "${RUNNER_OS:-}" = Linux ] || { echo 'This test requires a GitHub Actions Linux runner'; exit 1; }
[ ! -e /opt/fathi ] || { echo 'Refusing to replace an existing installation'; exit 1; }
ROOT=$(pwd)
FIXTURE=$(mktemp -d)
export FIXTURE
cleanup() { rm -rf "$FIXTURE"; }
trap cleanup EXIT
mkdir -p "$FIXTURE/input" "$FIXTURE/Fathi-1.0.2-linux-x64/resources" "$FIXTURE/bin"
echo '{"name":"fathi","version":"1.0.2"}' > "$FIXTURE/input/package.json"
node -e 'require("@electron/asar").createPackage(process.env.FIXTURE + "/input", process.env.FIXTURE + "/Fathi-1.0.2-linux-x64/resources/app.asar").catch(e => { console.error(e); process.exit(1); })'
printf '#!/bin/sh\necho 1.0.2\n' > "$FIXTURE/Fathi-1.0.2-linux-x64/fathi"
touch "$FIXTURE/Fathi-1.0.2-linux-x64/chrome-sandbox"
chmod +x "$FIXTURE/Fathi-1.0.2-linux-x64/fathi"
tar -czf "$FIXTURE/archive" -C "$FIXTURE" Fathi-1.0.2-linux-x64
python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
p = Path(os.environ['FIXTURE'])
a = {'name': 'Fathi-1.0.2-linux-x64.tar.gz', 'digest': 'sha256:' + hashlib.sha256((p / 'archive').read_bytes()).hexdigest(), 'browser_download_url': 'https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-1.0.2-linux-x64.tar.gz'}
(p / 'release.json').write_text(json.dumps({'tag_name': 'v1.0.2', 'assets': [a]}))
(p / 'assets.html').write_text('<a href="/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-1.0.2-linux-x64.tar.gz">Linux</a><clipboard-copy aria-label="Copy to clipboard digest for Fathi-1.0.2-linux-x64.tar.gz" value="' + a['digest'] + '"></clipboard-copy>')
PY
cat > "$FIXTURE/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -e
out=''; url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) out=$2; shift 2 ;;
    --retry) shift 2 ;;
    https:*) url=$1; shift ;;
    *) shift ;;
  esac
done
case "$url" in
  https://api.github.com/*) if [ -f "$FIXTURE/api-down" ]; then exit 22; else cp "$FIXTURE/release.json" "$out"; fi ;;
  https://github.com/iMumd/fathi-browser/releases/latest) echo '<html></html>' > "$out"; printf 'https://github.com/iMumd/fathi-browser/releases/tag/v1.0.2' ;;
  https://github.com/iMumd/fathi-browser/releases/expanded_assets/v1.0.2) cp "$FIXTURE/assets.html" "$out" ;;
  *) cp "$FIXTURE/archive" "$out" ;;
esac
MOCK
chmod +x "$FIXTURE/bin/curl"
export PATH="$FIXTURE/bin:$PATH"
mkdir -p "$HOME/.local/share/applications"
printf '[Desktop Entry]\nName=Fathi\nExec=/old/fathi\n' > "$HOME/.local/share/applications/old-fathi.desktop"
bash "$ROOT/tools/update-fathi.sh"
test "$(readlink /usr/local/bin/fathi)" = /opt/fathi/fathi
test "$(stat -c %a /opt/fathi/chrome-sandbox)" = 4755
grep -q 'Exec=/opt/fathi/fathi %U' "$HOME/.local/share/applications/old-fathi.desktop"
cmp "$FIXTURE/Fathi-1.0.2-linux-x64/resources/app.asar" /opt/fathi/resources/app.asar
touch "$FIXTURE/api-down"
bash "$ROOT/tools/update-fathi.sh" > "$FIXTURE/fallback.log"
grep -q 'API unavailable' "$FIXTURE/fallback.log"
grep -q 'Installed and verified v1.0.2' "$FIXTURE/fallback.log"
cmp "$FIXTURE/Fathi-1.0.2-linux-x64/resources/app.asar" /opt/fathi/resources/app.asar
echo tampered >> "$FIXTURE/archive"
if bash "$ROOT/tools/update-fathi.sh" > "$FIXTURE/failure.log" 2>&1; then echo 'Checksum mismatch was not rejected'; exit 1; fi
grep -q 'checksum mismatch' "$FIXTURE/failure.log"
test -x /opt/fathi/fathi
echo 'Linux updater integration tests passed'
