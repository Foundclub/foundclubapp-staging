param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseStorePassword,

  [Parameter(Mandatory = $true)]
  [string]$ReleaseKeyPassword,

  [Parameter(Mandatory = $true)]
  [int]$VersionCode,

  [Parameter(Mandatory = $true)]
  [string]$VersionName
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$androidDir = Join-Path $repoRoot 'android'
$appDir = Join-Path $androidDir 'app'
$productionGoogleServices = Join-Path $appDir 'src\\production\\google-services.json'
$keystorePath = Join-Path $appDir 'keystore'
$envFilePath = Join-Path $repoRoot '.env.production'
$runtimeValidator = Join-Path $repoRoot 'scripts\\validate-runtime-env.js'

function Import-DotEnvFile {
  param([string]$Path)

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) {
      return
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
      return
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

Write-Host '[release] Android production preflight'

if (-not (Test-Path $envFilePath)) {
  throw "Missing .env.production at $envFilePath"
}

if (-not (Test-Path $productionGoogleServices)) {
  throw "Missing production google-services.json at $productionGoogleServices"
}

if (-not (Test-Path $keystorePath)) {
  throw "Missing Android keystore at $keystorePath"
}

Import-DotEnvFile -Path $envFilePath

Push-Location $repoRoot
try {
  node $runtimeValidator
} finally {
  Pop-Location
}

Push-Location $androidDir
try {
  Write-Host '[release] Launching bundleProductionRelease'
  & .\gradlew.bat bundleProductionRelease `
    "-PRELEASE_STORE_PASSWORD=$ReleaseStorePassword" `
    "-PRELEASE_KEY_PASSWORD=$ReleaseKeyPassword" `
    "-PversionCode=$VersionCode" `
    "-PversionName=$VersionName"
} finally {
  Pop-Location
}

$bundleOutput = Join-Path $appDir 'build\\outputs\\bundle\\productionRelease'

Write-Host '[release] Done'
Write-Host "[release] Expected output folder: $bundleOutput"
