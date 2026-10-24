# Fathi Updater for Windows
$repo = "iMumd/fathi-browser"
$api = "https://api.github.com/repos/$repo/releases/latest"
$release = Invoke-RestMethod -Uri $api -Headers @{ "User-Agent" = "fathi-updater" }
$tag = $release.tag_name
$asset = $release.assets | Where-Object { $_.name -like "Fathi-Setup-*.exe" -or $_.name -like "Fathi-Portable-*.exe" } | Select-Object -First 1

if (-not $asset) {
  Write-Host "No Windows asset found. Check https://github.com/$repo/releases"
  exit 1
}

Write-Host "[Fathi Updater] Latest version: $tag"
$out = Join-Path $env:TEMP "Fathi-Update-$tag.exe"
Write-Host "[Fathi Updater] Downloading $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $out
Write-Host "[Fathi Updater] Launching installer..."
Start-Process -FilePath $out -Verb runas
