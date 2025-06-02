@echo off
REM Start Dinguscord Microservices - Windows Batch Version

echo ================================================
echo   Starting Dinguscord Microservices
echo ================================================
echo.

REM Check if Docker is running
echo Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo Docker is running

REM Determine which Docker Compose file to use
set COMPOSE_FILE=docker-compose.windows.yml
if not exist "%COMPOSE_FILE%" (
    echo WARNING: Windows-specific compose file not found, using default...
    set COMPOSE_FILE=docker-compose.yml
)

echo.
echo Starting backend services with Docker Compose...
echo Using: %COMPOSE_FILE%

REM Start backend services
docker-compose -f %COMPOSE_FILE% up -d
if errorlevel 1 (
    echo ERROR: Failed to start Docker services
    pause
    exit /b 1
)
echo Backend services started successfully

echo.
echo Waiting for services to initialize...
timeout /t 15 /nobreak >nul

echo.
echo Checking service health...

REM Check API Gateway health
echo Checking API Gateway...
curl -s http://localhost:8080/health >nul 2>&1
if errorlevel 1 (
    echo WARNING: API Gateway is not responding yet
) else (
    echo API Gateway is healthy
)

REM Set up environment variables for frontend
echo.
echo Setting up environment variables for frontend...
if not exist "DingusGui\DingusMessaging\.env.development" (
    echo Creating .env.development file...
    (
        echo VITE_API_URL=http://localhost:8080
        echo VITE_SOCKET_URL=http://localhost:3003
    ) > "DingusGui\DingusMessaging\.env.development"
    echo Environment file created
) else (
    echo Environment file already exists
)

REM Check if frontend dependencies are installed
echo.
echo Checking frontend dependencies...
if not exist "DingusGui\DingusMessaging\node_modules" (
    echo Installing frontend dependencies...
    cd DingusGui\DingusMessaging
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install frontend dependencies
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
    echo Frontend dependencies installed
) else (
    echo Frontend dependencies already installed
)

echo.
echo Starting frontend in development mode...
echo Frontend will open at: http://localhost:5173
echo.

cd DingusGui\DingusMessaging

REM Start the development server
echo Launching frontend development server...
npm run dev

REM This line might not be reached if npm run dev is blocking
cd ..\..
echo.
echo Dinguscord is now running!
pause 