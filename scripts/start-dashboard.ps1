param([switch]$InstallDependencies)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (!(Test-Path -LiteralPath '.env.local')) { throw 'Create .env.local from .env.example and follow DEPLOYMENT.md first.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
if ($InstallDependencies -or !(Test-Path -LiteralPath 'node_modules')) {
    & $npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& $npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
if (!(Test-Path -LiteralPath 'data')) { New-Item -ItemType Directory -Path 'data' | Out-Null }
$process = Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'data/server-output.log') -RedirectStandardError (Join-Path $projectRoot 'data/server-error.log') -PassThru
Write-Host "Started dashboard process $($process.Id). Check data/server-output.log and data/server-error.log. Default URL: http://localhost:3001"
