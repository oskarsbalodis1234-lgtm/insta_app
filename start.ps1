$ErrorActionPreference = "Continue"

# Check if Ollama is running silently to avoid security warnings
try {
    $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "Ollama service detected and ready." -ForegroundColor Green
} catch {
    Write-Host "Notice: Ollama service not detected at http://localhost:11434. AI research will require Ollama to be running." -ForegroundColor Yellow
}

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
