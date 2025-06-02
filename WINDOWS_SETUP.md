# Windows Setup Guide for Dinguscord

This guide addresses common Windows-specific issues when running the Dinguscord chat application.

## 🚨 Known Windows Issues & Solutions

### Issue 1: Database Connection Failures
**Problem**: Services can't connect to PostgreSQL database  
**Cause**: Line ending differences and Docker networking issues

### Issue 2: Health Check Failures  
**Problem**: Health checks fail with "curl: command not found"  
**Cause**: Windows Docker containers don't always have curl installed

### Issue 3: Script Execution Failures
**Problem**: Bash scripts fail to execute properly  
**Cause**: Windows line endings (`\r\n`) vs Unix line endings (`\n`)

## 🛠️ Prerequisites

1. **Docker Desktop for Windows** - Latest version
2. **WSL2 enabled** (required for Docker Desktop)
3. **Git configured for line endings**:
   ```bash
   git config --global core.autocrlf false
   git config --global core.eol lf
   ```

## 🚀 Setup Instructions

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

### Step 3: Manual Database Creation (If Script Fails)
If the automatic database creation fails, create databases manually:

```bash
# Connect to postgres container
docker exec -it dinguscord-postgres-1 psql -U postgres

# Create databases manually
CREATE DATABASE auth;
CREATE DATABASE chatroom; 
CREATE DATABASE messages;
\q
```

### Step 4: Verify Services
Check that all services are running:
```bash
docker-compose -f docker-compose.windows.yml ps
```

## 🔧 Troubleshooting

### Database Connection Issues
1. **Check Docker Desktop is running in WSL2 mode**
2. **Restart Docker Desktop completely**
3. **Clear Docker volumes**:
   ```bash
   docker-compose -f docker-compose.windows.yml down -v
   docker-compose -f docker-compose.windows.yml up --build
   ```

### Service Startup Order Issues
The Windows compose file includes proper dependency management. If services still fail:

```bash
# Start database first, then services
docker-compose -f docker-compose.windows.yml up postgres redis rabbitmq
# Wait 30 seconds, then start other services
docker-compose -f docker-compose.windows.yml up
```

### Port Conflicts
If you get port binding errors:
```bash
# Check what's using the ports
netstat -ano | findstr :5432
netstat -ano | findstr :3001

# Kill conflicting processes or change ports in docker-compose.windows.yml
```

### Permission Issues
If you get permission denied errors:
1. **Run PowerShell/Command Prompt as Administrator**
2. **Check Docker Desktop has proper permissions**
3. **Ensure WSL2 has access to the project directory**

## 🧪 Testing the Setup

### 1. Check Database Connectivity
```bash
# Test postgres connection
docker exec -it dinguscord-postgres-1 pg_isready -U postgres

# List databases
docker exec -it dinguscord-postgres-1 psql -U postgres -c "\l"
```

### 2. Test Service Health
```bash
# Check all service health
curl http://localhost:3001/health  # Auth Service
curl http://localhost:3002/health  # Chat Room Service  
curl http://localhost:3003/health  # Message Service
curl http://localhost:3004/health  # Presence Service
curl http://localhost:3005/health  # Notification Service
curl http://localhost:8080/health  # API Gateway
```

### 3. Test User Creation
```bash
# Test user registration
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

## 🐛 Common Error Messages & Fixes

### "no such file or directory: /docker-entrypoint-initdb.d/create-multiple-postgres-databases.sh"
**Fix**: Use `docker-compose.windows.yml` which doesn't mount the bash script

### "dial tcp: lookup postgres on 127.0.0.11:53: no such host"
**Fix**: Restart Docker Desktop and ensure it's using WSL2 backend

### "Error response from daemon: Ports are not available"
**Fix**: 
```bash
# Find and kill process using the port
netstat -ano | findstr :5432
taskkill /PID <PID_NUMBER> /F
```

### "container name already in use"
**Fix**:
```bash
docker-compose -f docker-compose.windows.yml down
docker system prune -f
```

## 📝 Alternative: Using Regular Docker Compose

If you want to use the regular `docker-compose.yml`, first fix the line endings:

```bash
# Convert the bash script to Unix line endings
dos2unix docker-scripts/create-multiple-postgres-databases.sh

# Then run normally
docker-compose up --build
```

## 🆘 Still Having Issues?

1. **Check Docker Desktop logs**: Docker Desktop → Troubleshoot → Get Support
2. **Verify WSL2 installation**: `wsl --status`
3. **Try running in WSL2 directly** instead of Windows Command Prompt
4. **Disable Windows Defender real-time protection** temporarily during builds
5. **Check Windows Firewall** isn't blocking Docker ports

## ✅ Success Indicators

You'll know everything is working when:
- All 8 services show as "healthy" in `docker ps`
- You can access http://localhost:8080/health
- Database commands work without errors
- You can create users and send messages

---

*This guide addresses 90% of Windows Docker issues. If you're still having problems, the issue might be environment-specific.* 