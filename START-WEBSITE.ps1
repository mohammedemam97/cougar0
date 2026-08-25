$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js was not found. Install Node.js first.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not $env:STRIPE_SECRET_KEY) {
  Write-Host 'Enter your Stripe SECRET key. It will not be saved to the website files.' -ForegroundColor Cyan
  $secure = Read-Host 'Stripe secret key' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $env:STRIPE_SECRET_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$env:PORT = '8787'
Write-Host 'Starting COUGAR at http://localhost:8787 ...' -ForegroundColor Green
Write-Host 'Keep this window open while using the store.' -ForegroundColor Yellow
node server.js
