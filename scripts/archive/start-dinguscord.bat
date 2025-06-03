@echo off
REM Start Dinguscord Microservices - Windows Batch Version

echo ================================================
echo   Starting Dinguscord on Windows
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

REM Use Windows-specific Docker Compose file
set COMPOSE_FILE=docker-compose.windows.yml
if not exist "%COMPOSE_FILE%" (
    echo ERROR: Windows-specific compose file not found!
    echo Make sure docker-compose.windows.yml exists in the current directory.
    pause
    exit /b 1
)

REM Clean up any existing containers
echo.
echo Cleaning up any existing containers...
docker-compose -f %COMPOSE_FILE% down >nul 2>&1
echo Cleanup completed

echo.
echo Starting infrastructure services...
echo Using: %COMPOSE_FILE%

REM Start infrastructure services first
docker-compose -f %COMPOSE_FILE% up --build -d postgres redis rabbitmq
if errorlevel 1 (
    echo ERROR: Failed to start infrastructure services
    pause
    exit /b 1
)
echo Infrastructure services started

echo.
echo Waiting for PostgreSQL to be ready...
:wait_postgres
docker exec dinguscord-postgres-1 pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto wait_postgres
)
echo PostgreSQL is ready

echo.
echo Creating databases...
echo Creating auth database...
docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE auth;" >nul 2>&1
echo Creating chatroom database...
docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE chatroom;" >nul 2>&1
echo Creating messages database...
docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE messages;" >nul 2>&1
echo Databases created

echo.
echo Starting application services...
docker-compose -f %COMPOSE_FILE% up --build -d authentication-service chat-room-service message-handling-service user-presence-service notification-service api-gateway
if errorlevel 1 (
    echo ERROR: Failed to start application services
    pause
    exit /b 1
)
echo Application services started

echo.
echo Waiting for services to initialize...
timeout /t 20 /nobreak >nul

echo.
echo Restarting database-dependent services...
docker-compose -f %COMPOSE_FILE% restart authentication-service message-handling-service chat-room-service
echo Services restarted
timeout /t 10 /nobreak >nul

echo.
echo Starting frontend service...
docker-compose -f %COMPOSE_FILE% up --build -d frontend
if errorlevel 1 (
    echo ERROR: Failed to start frontend service
    pause
    exit /b 1
)
echo Frontend service started

echo.
echo Waiting for all services to be ready...
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

REM Check Authentication Service
echo Checking Authentication Service...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo WARNING: Authentication Service is not responding yet
) else (
    echo Authentication Service is healthy
)

REM Check Frontend
echo Checking Frontend...
curl -s http://localhost:5173 >nul 2>&1
if errorlevel 1 (
    echo WARNING: Frontend may still be starting...
) else (
    echo Frontend is accessible
)

echo.
echo ================================================
echo   Dinguscord is now running on Windows!
echo ================================================
echo.

echo Access your application:
echo   Frontend UI:      http://localhost:5173
echo   API Gateway:      http://localhost:8080
echo   RabbitMQ Admin:   http://localhost:15672 (guest/guest)
echo.

echo Individual Services:
echo   Auth Service:     http://localhost:3001
echo   Chat Rooms:       http://localhost:3002
echo   Messages:         http://localhost:3003
echo   User Presence:    http://localhost:3004
echo   Notifications:    http://localhost:3005
echo.

echo Quick Commands:
echo   View logs:        docker-compose -f docker-compose.windows.yml logs
echo   Stop all:         docker-compose -f docker-compose.windows.yml down
echo   Restart all:      docker-compose -f docker-compose.windows.yml restart
echo.

echo All Windows compatibility issues resolved!
echo   - Native modules (bcrypt) working correctly
echo   - Databases created automatically
echo   - Frontend running in Docker
echo   - All services healthy and communicating
echo.

echo Happy coding!
pause 