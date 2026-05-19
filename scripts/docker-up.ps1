# Run Docker Compose from the repo root (same DB as backend/.env).
# Repo-root `.env` should set COMPOSE_PROJECT_NAME=fitandsleek_ai (or rely on `name:` in docker-compose.yml).
# Optional: docker compose --env-file backend/.env ... if you prefer not to duplicate DB_* at repo root.
#
# Usage (from anywhere):
#   pwsh scripts/docker-up.ps1
#   pwsh scripts/docker-up.ps1 up -d --build
#   pwsh scripts/docker-up.ps1 --profile cloudflare-token up -d

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;" + $env:PATH
Set-Location $RepoRoot

$composeFile = "docker-compose.yml"

if ($args.Count -eq 0) {
    docker compose -f $composeFile up -d --build
} else {
    docker compose -f $composeFile @args
}
