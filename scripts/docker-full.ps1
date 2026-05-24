# Start the full stack (queues, scheduler, AI, pgAdmin).
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'docker-up.ps1') -Mode full
