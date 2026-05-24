$ErrorActionPreference = "Stop"

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) {
  throw "Docker Desktop CLI not found at: $docker"
}

Write-Host "Starting app services (backend/frontend/ngrok)..." -ForegroundColor Cyan
& $docker compose -f docker-compose.fullstack.yml up -d --no-deps backend frontend ngrok

$coreContainers = @("fitandsleek_db", "fitandsleek_pgadmin")
foreach ($name in $coreContainers) {
  $exists = (& $docker ps -a --filter "name=^/${name}$" --format "{{.Names}}")
  if ($exists -eq $name) {
    Write-Host "Starting existing container: $name" -ForegroundColor Yellow
    & $docker start $name | Out-Null
  } else {
    Write-Host "Container not found, creating via compose: $name" -ForegroundColor Yellow
    if ($name -eq "fitandsleek_db") {
      & $docker compose -f docker-compose.fullstack.yml up -d db
    } elseif ($name -eq "fitandsleek_pgadmin") {
      & $docker compose -f docker-compose.fullstack.yml up -d pgadmin
    }
  }
}

Write-Host ""
Write-Host "Services are ready:" -ForegroundColor Green
Write-Host " - Frontend : http://localhost:5173"
Write-Host " - Backend  : http://localhost:8000"
Write-Host " - pgAdmin  : http://localhost:5050"
Write-Host " - ngrok UI : http://localhost:4040"

Write-Host ""
Write-Host "Current container status:" -ForegroundColor Cyan
& $docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
