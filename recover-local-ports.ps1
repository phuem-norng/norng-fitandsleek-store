$ErrorActionPreference = "Stop"

Write-Host "Recovering Docker/WSL localhost port forwarding..." -ForegroundColor Cyan
wsl --shutdown

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) {
  throw "Docker CLI not found at: $docker"
}

Write-Host "Waiting for Docker daemon..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  try {
    & $docker version | Out-Null
    $ready = $true
    break
  } catch {}
}
if (-not $ready) {
  throw "Docker daemon did not become ready in time."
}

Write-Host "Starting core containers..." -ForegroundColor Yellow
& $docker start fitandsleek_db fitandsleek_pgadmin fitandsleek_backend fitandsleek_frontend fitandsleek_ngrok | Out-Null

Write-Host "Verifying URLs..." -ForegroundColor Yellow
$checks = @(
  "http://localhost:8000/",
  "http://localhost:5173/@react-refresh",
  "http://localhost:5050/browser/"
)

foreach ($url in $checks) {
  $ok = $false
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 700
    try {
      $res = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 4
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
        $ok = $true
        break
      }
    } catch {}
  }
  if ($ok) {
    Write-Host "OK  $url" -ForegroundColor Green
  } else {
    Write-Host "WARN $url (still warming up)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Recovery done." -ForegroundColor Green
