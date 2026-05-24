# Run Docker Compose from the repo root (same DB as backend/.env).
# Default is a light dev stack (db + backend + frontend). Heavy services are behind profiles.
#
# Usage (from anywhere):
#   pwsh scripts/docker-up.ps1
#   pwsh scripts/docker-up.ps1 -Mode full
#   pwsh scripts/docker-up.ps1 -Mode ai
#   pwsh scripts/docker-up.ps1 -Build
#   pwsh scripts/docker-up.ps1 up -d --build
#   pwsh scripts/docker-up.ps1 --profile cloudflare-token up -d

param(
    [ValidateSet('dev', 'full', 'ai', 'workers', 'tools')]
    [string]$Mode = 'dev',
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
Set-Location $RepoRoot

$composeFile = 'docker-compose.yml'

$profileArgs = switch ($Mode) {
    'dev' { @() }
    'full' { @('--profile', 'full') }
    'ai' { @('--profile', 'ai') }
    'workers' { @('--profile', 'workers') }
    'tools' { @('--profile', 'tools') }
}

if ($args.Count -eq 0) {
    $upArgs = @('up', '-d', '--remove-orphans')
    if ($Build) { $upArgs += '--build' }
    docker compose -f $composeFile @profileArgs @upArgs
} else {
    docker compose -f $composeFile @profileArgs @args
}
