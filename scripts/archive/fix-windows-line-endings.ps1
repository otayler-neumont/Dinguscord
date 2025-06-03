# Fix Windows Line Endings for Dinguscord
# This script converts the bash script to Unix line endings

Write-Host "Fixing line endings for Windows compatibility..." -ForegroundColor Green

$scriptPath = "docker-scripts/create-multiple-postgres-databases.sh"

if (Test-Path $scriptPath) {
    # Read file content
    $content = Get-Content $scriptPath -Raw
    
    # Convert CRLF to LF
    $content = $content -replace "`r`n", "`n"
    
    # Write back with UTF8 encoding without BOM
    [System.IO.File]::WriteAllText($scriptPath, $content, [System.Text.UTF8Encoding]::new($false))
    
    Write-Host "✓ Fixed line endings in $scriptPath" -ForegroundColor Green
} else {
    Write-Host "✗ Could not find $scriptPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "Now you can run:" -ForegroundColor Yellow
Write-Host "docker-compose up --build" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or use the Windows-optimized version:" -ForegroundColor Yellow  
Write-Host "docker-compose -f docker-compose.windows.yml up --build" -ForegroundColor Cyan 