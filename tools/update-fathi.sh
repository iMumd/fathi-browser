#!/usr/bin/env bash
set -e

REPO="iMumd/fathi-browser"
API="https://api.github.com/repos/$REPO/releases/latest"
TMPDIR="${TMPDIR:-/tmp}"
WORKDIR="$TMPDIR/fathi-update-$$"

echo "[Fathi Updater] Checking for updates..."
RELEASE=$(curl -fsSL "$API")
TAG=$(echo "$RELEASE" | grep -Po '"tag_name":\s*"\K[^"]+' | head -1)
ASSET=$(echo "$RELEASE" | grep -Po '"browser_download_url":\s*"\K[^"]+Fathi-[^"]+-linux-x64\.tar\.gz' | head -1)

if [ -z "$TAG" ] || [ -z "$ASSET" ]; then
  echo "[Fathi Updater] Could not find Linux asset. Check releases at https://github.com/$REPO/releases"
  exit 1
fi

echo "[Fathi Updater] Latest version: $TAG"
mkdir -p "$WORKDIR"
cd "$WORKDIR"
echo "[Fathi Updater] Downloading..."
curl -fL -o fathi.tar.gz "$ASSET"
echo "[Fathi Updater] Extracting..."
tar -xzf fathi.tar.gz

INSTDIR="/opt/fathi"
echo "[Fathi Updater] Installing to $INSTDIR (requires sudo)"
sudo mkdir -p "$INSTDIR"
sudo rm -rf "$INSTDIR"/*
sudo cp -a Fathi-*/* "$INSTDIR/" 2>/dev/null || sudo cp -a * "$INSTDIR/"
sudo chown -R root:root "$INSTDIR" 2>/dev/null || true
sudo chmod +x "$INSTDIR/fathi" 2>/dev/null || true
if [ -f "$INSTDIR/chrome-sandbox" ]; then
  sudo chmod 4755 "$INSTDIR/chrome-sandbox"
fi
sudo ln -sf "$INSTDIR/fathi" /usr/local/bin/fathi 2>/dev/null || true

if [ -f "$INSTDIR/fathi.desktop" ]; then
  sudo cp "$INSTDIR/fathi.desktop" /usr/share/applications/ 2>/dev/null || true
fi

rm -rf "$WORKDIR"
echo "[Fathi Updater] Updated to $TAG. Launch with: fathi"
