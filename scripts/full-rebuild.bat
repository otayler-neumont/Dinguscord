@echo off
REM Dinguscord Complete Database Reset Script
REM This script will completely tear down and rebuild all databases and services

echo.
echo 🔥 DINGUSCORD COMPLETE RESET SCRIPT 🔥
echo This will COMPLETELY DESTROY all data and rebuild from scratch!
echo.

REM Confirm with user
set /p confirmation="Are you sure you want to proceed? Type 'RESET' to continue: "
if not "%confirmation%"=="RESET" (
    echo ❌ Reset cancelled.
    pause
    exit /b 1
)

echo.
echo 🛑 Step 1: Stopping all services...
docker-compose -f docker-compose.windows.yml down
if errorlevel 1 (
    echo ❌ Failed to stop services
    pause
    exit /b 1
)

echo.
echo 🗑️  Step 2: Removing all Docker volumes...
docker volume prune -f
if errorlevel 1 (
    echo ❌ Failed to remove volumes
    pause
    exit /b 1
)

echo.
echo 🏗️  Step 3: Starting infrastructure services...
docker-compose -f docker-compose.windows.yml up -d postgres redis rabbitmq
if errorlevel 1 (
    echo ❌ Failed to start infrastructure
    pause
    exit /b 1
)

echo.
echo ⏳ Step 4: Waiting for PostgreSQL to be ready...
set /a retryCount=0
set /a maxRetries=30

:waitLoop
docker exec dinguscord-postgres-1 pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    set /a retryCount+=1
    echo    Attempt %retryCount%/%maxRetries% - Waiting for PostgreSQL...
    timeout /t 2 >nul
    if %retryCount% lss %maxRetries% goto waitLoop
    echo ❌ PostgreSQL failed to start within timeout
    pause
    exit /b 1
)
echo ✅ PostgreSQL is ready!

echo.
echo 🗃️  Step 5: Creating application databases...
echo    Dropping existing databases (if they exist)...
docker exec dinguscord-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS auth;"
docker exec dinguscord-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS messages;"
docker exec dinguscord-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS chatroom;"

echo    Creating database: auth
docker exec dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE auth;"
if errorlevel 1 (
    echo ❌ Failed to create database: auth
    pause
    exit /b 1
)

echo    Creating database: messages
docker exec dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE messages;"
if errorlevel 1 (
    echo ❌ Failed to create database: messages
    pause
    exit /b 1
)

echo    Creating database: chatroom
docker exec dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE chatroom;"
if errorlevel 1 (
    echo ❌ Failed to create database: chatroom
    pause
    exit /b 1
)

echo.
echo 🚀 Step 6: Building and starting all application services...
docker-compose -f docker-compose.windows.yml up --build -d
if errorlevel 1 (
    echo ❌ Failed to build and start services
    pause
    exit /b 1
)

echo.
echo ⏳ Step 7: Waiting for services to be healthy...
timeout /t 10 >nul

echo    Checking service health...
REM Simple health check by trying to connect to services
curl -f -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo    ❌ Authentication service is not responding
) else (
    echo    ✅ Authentication service is healthy
)

curl -f -s http://localhost:3002/health >nul 2>&1
if errorlevel 1 (
    echo    ❌ ChatRoom service is not responding
) else (
    echo    ✅ ChatRoom service is healthy
)

curl -f -s http://localhost:3003/health >nul 2>&1
if errorlevel 1 (
    echo    ❌ MessageHandling service is not responding
) else (
    echo    ✅ MessageHandling service is healthy
)

curl -f -s http://localhost:5173/ >nul 2>&1
if errorlevel 1 (
    echo    ❌ Frontend service is not responding
) else (
    echo    ✅ Frontend service is healthy
)

echo.
echo 🎉 RESET COMPLETE! Services are starting up with fresh databases!
echo.
echo 📋 Next Steps:
echo    1. Go to http://localhost:5173 to access the frontend
echo    2. Register new users (all previous data has been wiped)
echo    3. Create rooms and test the new persistent architecture
echo    4. Restart services to verify data persists!
echo.
echo 🔍 To check service logs: docker logs dinguscord-[service-name]-1
echo 🔍 To check database: docker exec -it dinguscord-postgres-1 psql -U postgres
echo.
pause 