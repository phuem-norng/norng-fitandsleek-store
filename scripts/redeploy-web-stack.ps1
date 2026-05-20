# Rebuild backend (nginx + php-fpm) and frontend (nav-badges, API tweaks) then restart.
# Usage: powershell -File scripts/redeploy-web-stack.ps1

$ErrorActionPreference = 'Stop'
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot

Write-Host "Building backend (nginx + php-fpm)..." -ForegroundColor Cyan
docker compose build --no-cache backend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building frontend..." -ForegroundColor Cyan
docker compose build frontend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Recreating backend + frontend..." -ForegroundColor Cyan
docker compose up -d --force-recreate backend frontend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Backend should NOT log 'Server running on' (that was artisan serve)." -ForegroundColor Green
Write-Host "Check: docker compose logs --tail=30 backend" -ForegroundColor Green
Write-Host "API:    http://localhost:8001" -ForegroundColor Green
Write-Host "Admin:  http://localhost:5173" -ForegroundColor Green
