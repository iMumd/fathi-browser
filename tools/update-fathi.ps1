# Fathi updater. Set FATHI_PORTABLE_PATH when replacing a portable executable.
$ErrorActionPreference = 'Stop'
$repo = 'iMumd/fathi-browser'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('fathi-update-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'fathi-updater' } -TimeoutSec 45
    } catch {
        Write-Host '[Fathi Updater] GitHub API unavailable. Checking the public release page...'
        $page = Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/releases/latest" -TimeoutSec 45
        $uri = $page.BaseResponse.ResponseUri
        if (-not $uri) { $uri = $page.BaseResponse.RequestMessage.RequestUri }
        if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'github.com' -or $uri.AbsolutePath -notmatch '^/iMumd/fathi-browser/releases/tag/(v\d+\.\d+\.\d+)$') { throw 'Could not resolve the latest stable public release' }
        $tag = $Matches[1]
        $assetPage = (Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/releases/expanded_assets/$tag" -TimeoutSec 45).Content
        $assets = @()
        foreach ($kind in @('Setup', 'Portable')) {
            $filename = "Fathi-$kind-$($tag.Substring(1)).exe"
            $pattern = 'aria-label="Copy to clipboard digest for ' + [regex]::Escape($filename) + '"[^>]*\bvalue="(sha256:[a-f0-9]{64})"'
            $match = [regex]::Match($assetPage, $pattern)
            $path = "/$repo/releases/download/$tag/$filename"
            if ($match.Success -and $assetPage.Contains('href="' + $path + '"')) { $assets += @{ name = $filename; digest = $match.Groups[1].Value; browser_download_url = "https://github.com$path" } }
        }
        $release = @{ tag_name = $tag; assets = $assets }
    }
    if ($release.tag_name -notmatch '^v\d+\.\d+\.\d+$') { throw 'Invalid stable release version' }
    $version = $release.tag_name.Substring(1)
    $portable = $env:FATHI_PORTABLE_PATH
    $name = if ($portable) { "Fathi-Portable-$version.exe" } else { "Fathi-Setup-$version.exe" }
    $asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if (-not $asset -or $asset.digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Release asset or SHA-256 digest is missing' }
    if (-not $asset.browser_download_url.StartsWith("https://github.com/$repo/releases/download/$($release.tag_name)/")) { throw 'Unexpected download URL' }
    $download = Join-Path $temp $name
    Write-Host "[Fathi Updater] Downloading $name..."
    Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $download
    if ((Get-FileHash $download -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.digest.Substring(7)) { throw 'Download checksum mismatch' }

    $running = @(Get-Process -Name fathi -ErrorAction SilentlyContinue)
    $installDir = $null
    foreach ($proc in $running) {
        if ($proc.Path -and (Test-Path (Join-Path (Split-Path $proc.Path) 'Uninstall Fathi.exe'))) {
            $installDir = Split-Path $proc.Path
            break
        }
    }
    if (-not $portable -and -not $installDir) {
        $keys = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
        $entry = Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'Fathi' } | Select-Object -First 1
        if ($entry -and $entry.InstallLocation) { $installDir = $entry.InstallLocation.TrimEnd('\') }
    }
    if (-not $portable -and $running.Count -and -not $installDir) {
        throw 'A portable copy is running. Close Fathi and set FATHI_PORTABLE_PATH to the original portable executable before updating.'
    }
    if ($portable -and -not (Test-Path -LiteralPath $portable -PathType Leaf)) { throw 'FATHI_PORTABLE_PATH must point to your existing portable executable' }
    foreach ($proc in $running) { $null = $proc.CloseMainWindow() }
    foreach ($proc in $running) {
        if (-not $proc.WaitForExit(15000)) { throw 'Close Fathi completely and retry. No files have been replaced.' }
    }
    if ($portable) {
        $downloadVersion = (Get-Item -LiteralPath $download).VersionInfo.ProductVersion -replace '\+.*$', ''
        if ($downloadVersion -ne $version) { throw 'Portable executable version does not match release' }
        $backup = "$portable.update-backup"
        if (Test-Path -LiteralPath $backup) { throw "Backup already exists: $backup" }
        Move-Item -LiteralPath $portable -Destination $backup
        try {
            Copy-Item -LiteralPath $download -Destination $portable
            if ((Get-FileHash -LiteralPath $portable -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash) { throw 'Installed portable checksum mismatch' }
        } catch {
            Remove-Item -LiteralPath $portable -Force -ErrorAction SilentlyContinue
            Move-Item -LiteralPath $backup -Destination $portable
            throw
        }
        Remove-Item -LiteralPath $backup
        $installed = $portable
    } else {
        if (-not $installDir) { $installDir = Join-Path $env:LOCALAPPDATA 'Programs\Fathi' }
        $arguments = "/S /D=$installDir"
        $start = @{ FilePath = $download; ArgumentList = $arguments; Wait = $true; PassThru = $true }
        if ($installDir.StartsWith($env:ProgramFiles, [StringComparison]::OrdinalIgnoreCase) -or ($entry -and $entry.PSPath -like '*HKEY_LOCAL_MACHINE*')) { $start.Verb = 'RunAs' }
        $installer = Start-Process @start
        if ($installer.ExitCode -ne 0) { throw "Installer failed with exit code $($installer.ExitCode)" }
        $installed = Join-Path $installDir 'Fathi.exe'
    }
    if (-not (Test-Path -LiteralPath $installed)) { throw "Updated executable not found at $installed" }
    $actual = (Get-Item -LiteralPath $installed).VersionInfo.ProductVersion -replace '\+.*$', ''
    if ($actual -ne $version) { throw "Installed version is $actual, expected $version. Update was not verified." }
    Write-Host "[Fathi Updater] Installed and verified $version at $installed. Preferences preserved."
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
