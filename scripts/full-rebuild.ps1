#!/usr/bin/env pwsh
# Dinguscord Complete Database Reset Script
# This script will completely tear down and rebuild all databases and services

Write-Host "🔥 DINGUSCORD COMPLETE RESET SCRIPT 🔥" -ForegroundColor Red
Write-Host "This will COMPLETELY DESTROY all data and rebuild from scratch!" -ForegroundColor Yellow
Write-Host ""

# Confirm with user
$confirmation = Read-Host "Are you sure you want to proceed? Type 'RESET' to continue"
if ($confirmation -ne "RESET") {
    Write-Host "❌ Reset cancelled." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🛑 Step 1: Stopping all services..." -ForegroundColor Cyan
docker-compose -f docker-compose.windows.yml down
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to stop services" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🗑️  Step 2: Removing all Docker volumes..." -ForegroundColor Cyan
docker volume prune -f
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to remove volumes" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🏗️  Step 3: Starting infrastructure services..." -ForegroundColor Cyan
docker-compose -f docker-compose.windows.yml up -d postgres redis rabbitmq
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start infrastructure" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Step 4: Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
$maxRetries = 30
$retryCount = 0
while ($retryCount -lt $maxRetries) {
    $result = docker exec dinguscord-postgres-1 pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    $retryCount++
    Write-Host "   Attempt $retryCount/$maxRetries - Waiting for PostgreSQL..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if ($retryCount -eq $maxRetries) {
    Write-Host "❌ PostgreSQL failed to start within timeout" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🗃️  Step 5: Creating application databases..." -ForegroundColor Cyan
$databases = @("auth", "messages", "chatroom")
foreach ($db in $databases) {
    Write-Host "   Creating database: $db" -ForegroundColor White
    docker exec dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE $db;"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create database: $db" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🚀 Step 6: Building and starting all application services..." -ForegroundColor Cyan
docker-compose -f docker-compose.windows.yml up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build and start services" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Step 7: Waiting for services to be healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check service health
$services = @(
    @{Name="Authentication"; Port=3001; Endpoint="/health"},
    @{Name="ChatRoom"; Port=3002; Endpoint="/health"},
    @{Name="MessageHandling"; Port=3003; Endpoint="/health"},
    @{Name="UserPresence"; Port=3004; Endpoint="/health"},
    @{Name="Notification"; Port=3005; Endpoint="/health"},
    @{Name="Frontend"; Port=5173; Endpoint="/"},
    @{Name="ApiGateway"; Port=8080; Endpoint="/health"}
)

$allHealthy = $true
foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)$($service.Endpoint)" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $($service.Name) service is healthy" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $($service.Name) service responded but may not be healthy (Status: $($response.StatusCode))" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ $($service.Name) service is not responding" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""
if ($allHealthy) {
    Write-Host "🎉 RESET COMPLETE! All services are running with fresh databases!" -ForegroundColor Green
} else {
    Write-Host "⚠️  RESET COMPLETE but some services may need more time to start" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Go to http://localhost:5173 to access the frontend"
Write-Host "   2. Register new users (all previous data has been wiped)"
Write-Host "   3. Create rooms and test the new persistent architecture"
Write-Host "   4. Restart services to verify data persists!"
Write-Host ""
Write-Host "🔍 To check service logs: docker logs dinguscord-[service-name]-1" -ForegroundColor White
Write-Host "🔍 To check database: docker exec -it dinguscord-postgres-1 psql -U postgres" -ForegroundColor White 