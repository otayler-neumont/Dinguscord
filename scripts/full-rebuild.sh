#!/bin/bash
# Dinguscord Complete Database Reset Script
# This script will completely tear down and rebuild all databases and services

echo "🔥 DINGUSCORD COMPLETE RESET SCRIPT 🔥"
echo "This will COMPLETELY DESTROY all data and rebuild from scratch!"
echo ""

# Confirm with user
read -p "Are you sure you want to proceed? Type 'RESET' to continue: " confirmation
if [ "$confirmation" != "RESET" ]; then
    echo "❌ Reset cancelled."
    exit 1
fi

echo ""
echo "🛑 Step 1: Stopping all services..."
docker-compose -f docker-compose.windows.yml down
if [ $? -ne 0 ]; then
    echo "❌ Failed to stop services"
    exit 1
fi

echo ""
echo "🗑️  Step 2: Removing all Docker volumes..."
docker volume prune -f
if [ $? -ne 0 ]; then
    echo "❌ Failed to remove volumes"
    exit 1
fi

echo ""
echo "🏗️  Step 3: Starting infrastructure services..."
docker-compose -f docker-compose.windows.yml up -d postgres redis rabbitmq
if [ $? -ne 0 ]; then
    echo "❌ Failed to start infrastructure"
    exit 1
fi

echo ""
echo "⏳ Step 4: Waiting for PostgreSQL to be ready..."
max_retries=30
retry_count=0
while [ $retry_count -lt $max_retries ]; do
    if docker exec dinguscord-postgres-1 pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    retry_count=$((retry_count + 1))
    echo "   Attempt $retry_count/$max_retries - Waiting for PostgreSQL..."
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "❌ PostgreSQL failed to start within timeout"
    exit 1
fi

echo ""
echo "🗃️  Step 5: Creating application databases..."
for db in auth messages chatroom; do
    echo "   Creating database: $db"
    docker exec dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE $db;"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create database: $db"
        exit 1
    fi
done

echo ""
echo "🚀 Step 6: Building and starting all application services..."
docker-compose -f docker-compose.windows.yml up --build -d
if [ $? -ne 0 ]; then
    echo "❌ Failed to build and start services"
    exit 1
fi

echo ""
echo "⏳ Step 7: Waiting for services to be healthy..."
sleep 10

# Check service health
declare -A services=(
    ["Authentication"]="3001:/health"
    ["ChatRoom"]="3002:/health"
    ["MessageHandling"]="3003:/health"
    ["UserPresence"]="3004:/health"
    ["Notification"]="3005:/health"
    ["Frontend"]="5173:/"
    ["ApiGateway"]="8080:/health"
)

all_healthy=true
for service in "${!services[@]}"; do
    IFS=':' read -r port endpoint <<< "${services[$service]}"
    if curl -f -s "http://localhost:$port$endpoint" > /dev/null 2>&1; then
        echo "   ✅ $service service is healthy"
    else
        echo "   ❌ $service service is not responding"
        all_healthy=false
    fi
done

echo ""
if [ "$all_healthy" = true ]; then
    echo "🎉 RESET COMPLETE! All services are running with fresh databases!"
else
    echo "⚠️  RESET COMPLETE but some services may need more time to start"
fi

echo ""
echo "📋 Next Steps:"
echo "   1. Go to http://localhost:5173 to access the frontend"
echo "   2. Register new users (all previous data has been wiped)"
echo "   3. Create rooms and test the new persistent architecture"
echo "   4. Restart services to verify data persists!"
echo ""
echo "🔍 To check service logs: docker logs dinguscord-[service-name]-1"
echo "🔍 To check database: docker exec -it dinguscord-postgres-1 psql -U postgres" 