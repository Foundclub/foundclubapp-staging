param(
  [string]$SecretsDir = $env:FOUNDCLUB_SECRETS_DIR
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SecretsDir)) {
  $SecretsDir = Join-Path $env:USERPROFILE ".foundclub-secrets\\mobile"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..")

$mapping = @(
  @{
    Source = Join-Path $SecretsDir "android\\google-services.json"
    Target = Join-Path $repoRoot "android\\app\\google-services.json"
    Required = $true
  },
  @{
    Source = Join-Path $SecretsDir "android\\google-services.staging.json"
    Target = Join-Path $repoRoot "android\\app\\src\\staging\\google-services.json"
    Required = $false
  },
  @{
    Source = Join-Path $SecretsDir "ios\\GoogleService-Info.plist"
    Target = Join-Path $repoRoot "ios\\GoogleService-Info.plist"
    Required = $true
  },
  @{
    Source = Join-Path $SecretsDir "android\\keystore"
    Target = Join-Path $repoRoot "android\\app\\keystore"
    Required = $false
  }
)

Write-Host "Using secrets directory: $SecretsDir"

$missingRequired = @()
foreach ($item in $mapping) {
  if (Test-Path $item.Source) {
    $targetDir = Split-Path $item.Target -Parent
    if (-not (Test-Path $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item -Path $item.Source -Destination $item.Target -Force
    Write-Host "Synced: $($item.Target)"
  } elseif ($item.Required) {
    $missingRequired += $item.Source
  } else {
    Write-Host "Skipped optional: $($item.Source)"
  }
}

if ($missingRequired.Count -gt 0) {
  Write-Error ("Missing required secret files:`n- " + ($missingRequired -join "`n- "))
}

Write-Host "Mobile secrets sync completed."
