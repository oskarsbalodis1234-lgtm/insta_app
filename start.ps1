$ErrorActionPreference = "Continue"

if (Get-Command py -ErrorAction SilentlyContinue) {
  Write-Host "Starting with Python (py)..." -ForegroundColor Cyan
  py server.py
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  Write-Host "Starting with Python..." -ForegroundColor Cyan
  python server.py
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "Starting with Node.js..." -ForegroundColor Cyan
  node server.js
} else {
  Write-Host "Could not find Node.js or Python. Install either one, then run .\start.ps1 again." -ForegroundColor Red
}
