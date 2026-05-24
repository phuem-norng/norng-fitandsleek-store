# Switch to the light dev stack (db + backend + frontend only).
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
Set-Location $RepoRoot

# Stop profiled services that may still be running from a previous full stack.
docker compose stop queue-worker scheduler ai-service qdrant pgadmin ngrok 2>$null | Out-Null
docker stop fitandsleek_tunnel fitandsleek_cf_frontend fitandsleek_cf_backend 2>$null | Out-Null

& (Join-Path $PSScriptRoot 'docker-up.ps1') -Mode dev
