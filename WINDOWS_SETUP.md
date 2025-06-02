# Windows Setup Guide for Dinguscord

This guide addresses common Windows-specific issues when running the Dinguscord chat application.

## 🚨 Known Windows Issues & Solutions

### Issue 1: Database Connection Failures ✅ SOLVED
**Problem**: Services can't connect to PostgreSQL database  
**Cause**: Line ending differences and Docker networking issues  
**Solution**: Automated database creation in launch scripts

### Issue 2: Health Check Failures ✅ SOLVED
**Problem**: Health checks fail with "curl: command not found"  
**Cause**: Windows Docker containers don't always have curl installed  
**Solution**: Using `wget` instead of `curl` in Windows Docker Compose

### Issue 3: Script Execution Failures ✅ SOLVED
**Problem**: Bash scripts fail to execute properly  
**Cause**: Windows line endings (`\r\n`) vs Unix line endings (`\n`)  
**Solution**: Removed problematic script mounting in Windows compose

### Issue 4: ERR_DLOPEN_FAILED - Native Module Errors ✅ SOLVED
**Problem**: Authentication service fails with "ERR_DLOPEN_FAILED" error loading shared library  
**Cause**: Native Node.js modules (like `bcrypt`) compiled for wrong architecture  
**Solution**: Windows-specific Dockerfiles that properly rebuild native modules

### Issue 5: Frontend Dependencies and Setup ✅ SOLVED
**Problem**: Node.js/npm not available on Windows for frontend development  
**Cause**: Local Node.js installation requirements  
**Solution**: Frontend now runs in Docker container with automated setup

## 🛠️ Prerequisites

1. **Docker Desktop for Windows** - Latest version
2. **WSL2 enabled** (required for Docker Desktop)
3. **Git configured for line endings**:
   ```bash
   git config --global core.autocrlf false
   git config --global core.eol lf
   ```

## 🚀 Quick Start (Fully Automated) ⭐

Everything is now automated! Just run one of these scripts:

**Option A: PowerShell Script (Recommended)**
```powershell
# Right-click PowerShell and "Run as Administrator"
.\start-dinguscord.ps1
```

**Option B: Batch File**
```cmd
# Double-click or run from Command Prompt
start-dinguscord.bat
```

### What the Scripts Do Automatically:

✅ **Infrastructure Setup**:
- Checks Docker is running
- Cleans up any existing containers
- Starts PostgreSQL, Redis, and RabbitMQ

✅ **Database Management**:
- Waits for PostgreSQL to be ready
- Creates `auth`, `chatroom`, and `messages` databases automatically
- Handles database connection retries

✅ **Service Orchestration**:
- Starts all microservices in correct order
- Restarts database-dependent services after DB creation
- Ensures all services are healthy

✅ **Frontend Setup**:
- Builds and starts frontend in Docker container
- No local Node.js installation required
- Automatic dependency management

✅ **Health Monitoring**:
- Checks all service endpoints
- Provides detailed status information
- Shows access URLs and management commands

## 🎯 What You Get

After running the script, you'll have:

- **Frontend UI**: http://localhost:5173
- **API Gateway**: http://localhost:8080  
- **Authentication Service**: http://localhost:3001 (bcrypt working!)
- **Chat Room Service**: http://localhost:3002
- **Message Handling**: http://localhost:3003
- **User Presence**: http://localhost:3004
- **Notifications**: http://localhost:3005
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## 🔧 Manual Setup (If You Prefer More Control)

### Step 1: Clone with Correct Line Endings
```bash
# If you already cloned, re-clone with correct settings
git clone https://github.com/your-repo/Dinguscord.git
cd Dinguscord

# Verify line endings are correct
git config core.autocrlf false
git config core.eol lf
```

### Step 2: Use Windows-Optimized Docker Compose
```bash
# Use the Windows-specific Docker Compose file
docker-compose -f docker-compose.windows.yml up --build
```

### Step 3: Manual Database Creation (If Needed)
```bash
# Create databases manually if automatic creation fails
docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE auth;"
docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE chatroom;"
docker exec -it dinguscord-postgres-1 psql -U postgres -c "CREATE DATABASE messages;"
```

## 🚀 Windows Launch Scripts

### PowerShell Script Features (`start-dinguscord.ps1`)
- ✅ Fully automated setup and database creation
- ✅ Colorful output with status indicators
- ✅ Comprehensive health checks for all services
- ✅ Frontend Docker container setup
- ✅ Detailed error reporting and troubleshooting info
- ✅ Service restart logic for database connectivity

### Batch File Features (`start-dinguscord.bat`)
- ✅ Simple, reliable batch script
- ✅ Same automation as PowerShell version
- ✅ Works on any Windows version
- ✅ No PowerShell execution policy issues

## 🔧 Troubleshooting

### All Major Issues Are Now Resolved! 🎉

The automated scripts handle:
- ✅ **Bcrypt ERR_DLOPEN_FAILED** - Fixed with proper native module rebuilding
- ✅ **Database connectivity** - Automated database creation and service restarts
- ✅ **Frontend setup** - Docker-based frontend, no local Node.js needed
- ✅ **Service startup order** - Intelligent orchestration and health monitoring

### If You Still Have Issues:

**Check Docker Status**:
```bash
docker ps  # Should show all services running
docker-compose -f docker-compose.windows.yml logs  # Check for errors
```

**Restart Everything**:
```bash
docker-compose -f docker-compose.windows.yml down
.\start-dinguscord.ps1  # Run the script again
```

**PowerShell Execution Policy**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🧪 Testing the Setup

### 1. Open the Frontend
Navigate to: http://localhost:5173

### 2. Test User Registration
Create a new account through the UI to test bcrypt functionality

### 3. Test Real-time Features  
Send messages to test WebSocket connections and RabbitMQ

### 4. Check Service Health
All services should show as healthy in Docker Desktop or via:
```bash
docker ps
```

## 📋 Quick Reference

### Essential Commands
```bash
# Start everything
.\start-dinguscord.ps1

# View logs
docker-compose -f docker-compose.windows.yml logs

# Stop everything  
docker-compose -f docker-compose.windows.yml down

# Restart specific service
docker-compose -f docker-compose.windows.yml restart authentication-service
```

### Service URLs
- Frontend: http://localhost:5173
- API Gateway: http://localhost:8080
- Auth Service: http://localhost:3001
- Chat Rooms: http://localhost:3002  
- Messages: http://localhost:3003
- Presence: http://localhost:3004
- Notifications: http://localhost:3005

## 🎉 Success!

Your Windows setup is now:
- ✅ **Fully automated** - One script does everything
- ✅ **Bcrypt working** - No more native module errors
- ✅ **Database ready** - Automatic creation and connection
- ✅ **Frontend live** - Docker-based UI development
- ✅ **Production-ready** - All services healthy and communicating

**Your teammates can now use this exact setup on their Windows machines!** 🚀 