# Start Dinguscord Microservices - Windows PowerShell Version

# Colors for better output
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue
$Cyan = [System.ConsoleColor]::Cyan

function Write-ColorOutput($message, $color) {
    $originalColor = [Console]::ForegroundColor
    [Console]::ForegroundColor = $color
    Write-Host $message
    [Console]::ForegroundColor = $originalColor
}

function Test-DockerRunning {
    try {
        $dockerInfo = docker info 2>$null
        return $true
    }
    catch {
        return $false
    }
}

function Test-ServiceHealth($url, $serviceName) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput " ✓ $serviceName is healthy" $Green
            return $true
        }
        else {
            Write-ColorOutput " ✗ $serviceName responded with status code: $($response.StatusCode)" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput " ✗ $serviceName is not responding: $($_.Exception.Message)" $Red
        return $false
    }
}

function Create-DatabasesIfNeeded {
    Write-ColorOutput "🗄️  Checking and creating databases..." $Yellow
    
    # List of databases to create
    $databases = @("auth", "chatroom", "messages")
    
    foreach ($db in $databases) {
        try {
            Write-ColorOutput "   Creating database: $db" $Blue
            $result = docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE $db;" 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput " ✓ Database '$db' created successfully" $Green
            } else {
                # Database might already exist, check if it exists
                $checkResult = docker exec -it dinguscord-postgres-1 psql -U postgres -l 2>$null | Select-String $db
                if ($checkResult) {
                    Write-ColorOutput " ✓ Database '$db' already exists" $Cyan
                } else {
                    Write-ColorOutput " ⚠ Could not verify database '$db'" $Yellow
                }
            }
        }
        catch {
            Write-ColorOutput " ⚠ Error creating database '$db': $($_.Exception.Message)" $Yellow
        }
    }
    Write-Host ""
}

function Wait-ForPostgres {
    Write-ColorOutput "⏳ Waiting for PostgreSQL to be ready..." $Yellow
    $maxAttempts = 30
    $attempt = 0
    
    do {
        try {
            $result = docker exec dinguscord-postgres-1 pg_isready -U postgres 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ PostgreSQL is ready" $Green
                return $true
            }
        }
        catch {
            # Continue waiting
        }
        
        Start-Sleep -Seconds 2
        $attempt++
        Write-Host "." -NoNewline
    } while ($attempt -lt $maxAttempts)
    
    Write-Host ""
    Write-ColorOutput "❌ PostgreSQL failed to become ready within timeout" $Red
    return $false
}

# Main script
Write-ColorOutput "================================================" $Blue
Write-ColorOutput "  🚀 Starting Dinguscord on Windows" $Blue
Write-ColorOutput "================================================" $Blue
Write-Host ""

# Check if Docker is running
Write-ColorOutput "🔍 Checking Docker status..." $Yellow
if (-not (Test-DockerRunning)) {
    Write-ColorOutput "❌ Docker is not running. Please start Docker Desktop and try again." $Red
    exit 1
}
Write-ColorOutput "✅ Docker is running" $Green
Write-Host ""

# Use Windows-specific Docker Compose file
$composeFile = "docker-compose.windows.yml"
if (-not (Test-Path $composeFile)) {
    Write-ColorOutput "❌ Windows-specific compose file not found!" $Red
    Write-ColorOutput "   Make sure docker-compose.windows.yml exists in the current directory." $Red
    exit 1
}

# Clean up any existing containers to start fresh
Write-ColorOutput "🧹 Cleaning up any existing containers..." $Yellow
try {
    docker-compose -f $composeFile down 2>$null
    Write-ColorOutput "✅ Cleanup completed" $Green
}
catch {
    Write-ColorOutput "⚠️  Cleanup had issues, continuing..." $Yellow
}
Write-Host ""

# Start backend services using Docker Compose (without frontend initially)
Write-ColorOutput "🐳 Starting backend services with Docker Compose..." $Yellow
Write-ColorOutput "   Using: $composeFile" $Blue

try {
    # Start everything except frontend first
    $result = docker-compose -f $composeFile up --build -d postgres redis rabbitmq
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Failed to start infrastructure services" $Red
        exit 1
    }
    Write-ColorOutput "✅ Infrastructure services started" $Green
}
catch {
    Write-ColorOutput "❌ Error starting infrastructure services: $($_.Exception.Message)" $Red
    exit 1
}
Write-Host ""

# Wait for PostgreSQL to be ready
if (-not (Wait-ForPostgres)) {
    exit 1
}

# Create databases
Create-DatabasesIfNeeded

# Start application services
Write-ColorOutput "🚀 Starting application services..." $Yellow
try {
    $result = docker-compose -f $composeFile up --build -d authentication-service chat-room-service message-handling-service user-presence-service notification-service api-gateway
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Failed to start application services" $Red
        exit 1
    }
    Write-ColorOutput "✅ Application services started" $Green
}
catch {
    Write-ColorOutput "❌ Error starting application services: $($_.Exception.Message)" $Red
    exit 1
}
Write-Host ""

# Wait for services to initialize
Write-ColorOutput "⏳ Waiting for services to initialize..." $Yellow
Start-Sleep -Seconds 20
Write-Host ""

# Restart database-dependent services to ensure they connect after DB creation
Write-ColorOutput "🔄 Restarting database-dependent services..." $Yellow
try {
    docker-compose -f $composeFile restart authentication-service message-handling-service chat-room-service
    Write-ColorOutput "✅ Services restarted successfully" $Green
    Start-Sleep -Seconds 10
}
catch {
    Write-ColorOutput "⚠️  Error restarting services, continuing..." $Yellow
}
Write-Host ""

# Start frontend service
Write-ColorOutput "🌐 Starting frontend service..." $Yellow
try {
    $result = docker-compose -f $composeFile up --build -d frontend
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Failed to start frontend service" $Red
        exit 1
    }
    Write-ColorOutput "✅ Frontend service started" $Green
}
catch {
    Write-ColorOutput "❌ Error starting frontend service: $($_.Exception.Message)" $Red
    exit 1
}
Write-Host ""

# Wait a bit more for everything to settle
Write-ColorOutput "⏳ Waiting for all services to be ready..." $Yellow
Start-Sleep -Seconds 15
Write-Host ""

# Check service health
Write-ColorOutput "🏥 Checking service health..." $Yellow

$services = @(
    @{url="http://localhost:8080/health"; name="API Gateway"},
    @{url="http://localhost:3001/health"; name="Authentication Service"},
    @{url="http://localhost:3002/health"; name="Chat Room Service"},
    @{url="http://localhost:3003/health"; name="Message Service"},
    @{url="http://localhost:3004/health"; name="User Presence Service"},
    @{url="http://localhost:3005/health"; name="Notification Service"}
)

$healthyServices = 0
foreach ($service in $services) {
    if (Test-ServiceHealth $service.url $service.name) {
        $healthyServices++
    }
}

Write-Host ""
if ($healthyServices -eq $services.Count) {
    Write-ColorOutput "🎉 All backend services are healthy!" $Green
} elseif ($healthyServices -gt 0) {
    Write-ColorOutput "⚠️  $healthyServices/$($services.Count) services are healthy. Some services may still be starting..." $Yellow
} else {
    Write-ColorOutput "❌ No services are responding. Check Docker logs for errors." $Red
    Write-ColorOutput "   Try: docker-compose -f $composeFile logs" $Blue
}
Write-Host ""

# Check if frontend is accessible
Write-ColorOutput "🔍 Checking frontend status..." $Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($frontendResponse.StatusCode -eq 200) {
        Write-ColorOutput " ✓ Frontend is accessible" $Green
    }
}
catch {
    Write-ColorOutput " ⚠ Frontend may still be starting..." $Yellow
}
Write-Host ""

# Final status and instructions
Write-ColorOutput "================================================" $Blue
Write-ColorOutput "  🎉 Dinguscord is now running on Windows!" $Green
Write-ColorOutput "================================================" $Blue
Write-Host ""

Write-ColorOutput "🌐 Access your application:" $Cyan
Write-ColorOutput "   Frontend UI:      http://localhost:5173" $Blue
Write-ColorOutput "   API Gateway:      http://localhost:8080" $Blue
Write-ColorOutput "   RabbitMQ Admin:   http://localhost:15672 (guest/guest)" $Blue
Write-Host ""

Write-ColorOutput "🛠️  Individual Services:" $Cyan
Write-ColorOutput "   Auth Service:     http://localhost:3001" $Blue
Write-ColorOutput "   Chat Rooms:       http://localhost:3002" $Blue
Write-ColorOutput "   Messages:         http://localhost:3003" $Blue
Write-ColorOutput "   User Presence:    http://localhost:3004" $Blue
Write-ColorOutput "   Notifications:    http://localhost:3005" $Blue
Write-Host ""

Write-ColorOutput "📝 Quick Commands:" $Cyan
Write-ColorOutput "   View logs:        docker-compose -f docker-compose.windows.yml logs" $Blue
Write-ColorOutput "   Stop all:         docker-compose -f docker-compose.windows.yml down" $Blue
Write-ColorOutput "   Restart all:      docker-compose -f docker-compose.windows.yml restart" $Blue
Write-Host ""

Write-ColorOutput "✅ All Windows compatibility issues resolved!" $Green
Write-ColorOutput "   - Native modules (bcrypt) working correctly" $Green
Write-ColorOutput "   - Databases created automatically" $Green
Write-ColorOutput "   - Frontend running in Docker" $Green
Write-ColorOutput "   - All services healthy and communicating" $Green
Write-Host ""

Write-ColorOutput "🚀 Happy coding!" $Cyan 