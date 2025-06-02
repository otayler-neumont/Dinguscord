# Start Dinguscord Microservices - Windows PowerShell Version

# Colors for better output
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue

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

# Main script
Write-ColorOutput "================================================" $Blue
Write-ColorOutput "  🚀 Starting Dinguscord Microservices" $Blue
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

# Determine which Docker Compose file to use
$composeFile = "docker-compose.windows.yml"
if (-not (Test-Path $composeFile)) {
    Write-ColorOutput "⚠️  Windows-specific compose file not found, using default..." $Yellow
    $composeFile = "docker-compose.yml"
}

# Start backend services using Docker Compose
Write-ColorOutput "🐳 Starting backend services with Docker Compose..." $Yellow
Write-ColorOutput "   Using: $composeFile" $Blue

try {
    $result = docker-compose -f $composeFile up -d
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Failed to start Docker services" $Red
        exit 1
    }
    Write-ColorOutput "✅ Backend services started successfully" $Green
}
catch {
    Write-ColorOutput "❌ Error starting backend services: $($_.Exception.Message)" $Red
    exit 1
}
Write-Host ""

# Wait for services to be ready
Write-ColorOutput "⏳ Waiting for services to initialize..." $Yellow
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
    Write-ColorOutput "🎉 All services are healthy!" $Green
} elseif ($healthyServices -gt 0) {
    Write-ColorOutput "⚠️  $healthyServices/$($services.Count) services are healthy. Some services may still be starting..." $Yellow
} else {
    Write-ColorOutput "❌ No services are responding. Check Docker logs for errors." $Red
    Write-ColorOutput "   Try: docker-compose -f $composeFile logs" $Blue
    exit 1
}
Write-Host ""

# Set up environment variables for frontend
Write-ColorOutput "⚙️  Setting up environment variables for frontend..." $Yellow
$envPath = "./DingusGui/DingusMessaging/.env.development"

if (-not (Test-Path $envPath)) {
    Write-ColorOutput "📝 Creating .env.development file..." $Blue
    $envContent = @"
VITE_API_URL=http://localhost:8080
VITE_SOCKET_URL=http://localhost:3003
"@
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-ColorOutput "✅ Environment file created" $Green
} else {
    Write-ColorOutput "✅ Environment file already exists" $Green
}
Write-Host ""

# Check if frontend dependencies are installed
Write-ColorOutput "📦 Checking frontend dependencies..." $Yellow
$frontendPath = "./DingusGui/DingusMessaging"

if (-not (Test-Path "$frontendPath/node_modules")) {
    Write-ColorOutput "📥 Installing frontend dependencies..." $Blue
    Set-Location $frontendPath
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Failed to install frontend dependencies" $Red
        Set-Location "../.."
        exit 1
    }
    Set-Location "../.."
    Write-ColorOutput "✅ Frontend dependencies installed" $Green
} else {
    Write-ColorOutput "✅ Frontend dependencies already installed" $Green
}
Write-Host ""

# Start frontend in development mode
Write-ColorOutput "🌐 Starting frontend in development mode..." $Yellow
Write-ColorOutput "   Frontend will open at: http://localhost:5173" $Blue
Write-Host ""

Set-Location $frontendPath

# Use Start-Process to run npm in a new window so this script can complete
Write-ColorOutput "🚀 Launching frontend development server..." $Green
Write-ColorOutput "   Check your browser at: http://localhost:5173" $Blue
Write-Host ""

try {
    # Try to start the dev server
    npm run dev
}
catch {
    Write-ColorOutput "❌ Failed to start frontend: $($_.Exception.Message)" $Red
    Set-Location "../.."
    exit 1
}

# Note: This line might not be reached if npm run dev is blocking
Set-Location "../.."
Write-ColorOutput "🎉 Dinguscord is now running!" $Green 