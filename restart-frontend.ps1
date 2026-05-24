$ErrorActionPreference = "Stop"

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) {
  throw "Docker Desktop CLI not found at: $docker"
}

Write-Host "Restarting fitandsleek_frontend..." -ForegroundColor Cyan
& $docker restart fitandsleek_frontend | Out-Null

Write-Host "Waiting for Vite endpoint..." -ForegroundColor Yellow
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:5173/node_modules/vite/dist/client/env.mjs" -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ok = $true
      break
    }
  } catch {
    # wait until server is ready
  }
}

if (-not $ok) {
  Write-Host "Frontend restarted, but health check is still warming up." -ForegroundColor Yellow
  exit 0
}

Write-Host "Frontend is ready: http://localhost:5173" -ForegroundColor Green
