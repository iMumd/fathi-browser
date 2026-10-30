$ErrorActionPreference = 'Stop'
$script:selected = $false
function Invoke-RestMethod { param($Uri, $Headers, $TimeoutSec) throw 'Simulated API 404' }
function Invoke-WebRequest {
    param([switch]$UseBasicParsing, $Uri, $TimeoutSec, $OutFile)
    if ($OutFile) {
        if ($Uri -ne 'https://github.com/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-Setup-1.0.2.exe') { throw "Wrong fallback asset: $Uri" }
        $script:selected = $true
        throw 'TEST_HALT_BEFORE_DOWNLOAD'
    }
    if ($Uri -like '*/releases/latest') { return @{ BaseResponse = @{ ResponseUri = [uri]'https://github.com/iMumd/fathi-browser/releases/tag/v1.0.2' } } }
    $digest = 'sha256:' + ('a' * 64)
    return @{ Content = '<a href="/iMumd/fathi-browser/releases/download/v1.0.2/Fathi-Setup-1.0.2.exe">Setup</a><clipboard-copy aria-label="Copy to clipboard digest for Fathi-Setup-1.0.2.exe" value="' + $digest + '"></clipboard-copy>' }
}
try {
    $env:FATHI_PORTABLE_PATH = ''
    . "$PSScriptRoot/update-fathi.ps1"
    throw 'Expected test download guard'
} catch {
    if (-not $script:selected -or $_.Exception.Message -ne 'TEST_HALT_BEFORE_DOWNLOAD') { throw }
}
Write-Output 'Windows API-404 public metadata fallback passed without downloading or executing an installer'
