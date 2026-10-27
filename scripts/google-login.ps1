param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceAccount
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$gcloudCommand = Join-Path $projectRoot '.tools/google-cloud-sdk/bin/gcloud.cmd'
if (!(Test-Path -LiteralPath $gcloudCommand)) {
    $installedGcloud = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
    if (!$installedGcloud) { throw 'Install the official Google Cloud CLI on PATH or in .tools/google-cloud-sdk first.' }
    $gcloudCommand = $installedGcloud.Source
}

# Keep CLI user credentials inside the ignored project credentials folder.
$env:CLOUDSDK_CONFIG = Join-Path $projectRoot 'credentials/gcloud'
$env:CLOUDSDK_CORE_DISABLE_USAGE_REPORTING = 'true'
& $gcloudCommand auth application-default login `
    "--impersonate-service-account=$ServiceAccount" `
    --no-launch-browser --disable-quota-project

if ($LASTEXITCODE -ne 0) { throw 'Google login did not complete.' }
$credentialPath = Join-Path $env:CLOUDSDK_CONFIG 'application_default_credentials.json'
if (!(Test-Path -LiteralPath $credentialPath)) {
    throw 'Google did not create the expected Application Default Credentials file.'
}

$envPath = Join-Path $projectRoot '.env.local'
$envText = if (Test-Path -LiteralPath $envPath) { Get-Content -LiteralPath $envPath -Raw } else { '' }
$credentialSetting = 'GOOGLE_APPLICATION_CREDENTIALS=' + ($credentialPath -replace '\\', '/')
if ($envText -match '(?m)^GOOGLE_APPLICATION_CREDENTIALS=') {
    $envText = [regex]::Replace($envText, '(?m)^GOOGLE_APPLICATION_CREDENTIALS=.*$', $credentialSetting)
} else {
    $envText += "`n$credentialSetting`n"
}
Set-Content -LiteralPath $envPath -Value $envText
Write-Output 'Keyless Google credentials configured. Restart the dashboard backend.'

