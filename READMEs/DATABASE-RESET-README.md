# 🔥 Dinguscord Database Reset Scripts

These scripts completely tear down and rebuild the entire Dinguscord application with fresh, empty databases. Perfect for development, testing, and cleaning up corrupted data.

## 🚨 **WARNING** 
**These scripts will COMPLETELY DESTROY ALL DATA!**
- All users will be deleted
- All chat rooms will be deleted  
- All messages will be deleted
- All room memberships will be deleted

## 📁 Available Scripts

### Windows (PowerShell)
```powershell
.\reset-database.ps1
```

### Linux/macOS (Bash)
```bash
chmod +x reset-database.sh
./reset-database.sh
```

## 🔄 What the Scripts Do

1. **🛑 Stop Services**: Gracefully stops all running containers
2. **🗑️ Clean Volumes**: Removes all Docker volumes (deletes all data)
3. **🏗️ Start Infrastructure**: Starts PostgreSQL, Redis, and RabbitMQ
4. **⏳ Wait for PostgreSQL**: Ensures database is ready before proceeding
5. **🗃️ Create Databases**: Creates `auth`, `messages`, and `chatroom` databases
6. **🚀 Build & Start**: Rebuilds and starts all application services
7. **✅ Health Check**: Verifies all services are responding correctly

## 🎯 When to Use

- **Fresh Development Start**: Clean slate for new development
- **Testing New Features**: Ensure no old data interferes with tests
- **Architecture Changes**: When database schema changes significantly
- **Corrupted Data**: When something goes wrong and you need to start over
- **Demo Preparation**: Clean environment for demonstrations

## 🔧 What Gets Reset

### **Databases Created**
- `auth` → User accounts, authentication data
- `messages` → Chat messages with sender usernames  
- `chatroom` → Room definitions and persistent memberships

### **Tables Auto-Created**
- `users` (auth database)
- `messages` (messages database) 
- `rooms` (chatroom database)
- `room_memberships` (chatroom database)

## ✅ After Reset

1. **Go to http://localhost:5173**
2. **Register new users** (old accounts are gone)
3. **Create chat rooms** 
4. **Add members to rooms**
5. **Send messages**
6. **Test persistence** by restarting services:
   ```
   docker-compose -f docker-compose.windows.yml restart
   ```

## 🧪 Testing the New Architecture

After reset, verify these improvements:

### ✅ **Persistent Room Memberships**
- Create room → Add users → Restart services → Users still in room

### ✅ **Real Usernames in Messages**  
- Messages show actual usernames instead of "User402"

### ✅ **Consistent Data Storage**
- Both messages AND room data persist through restarts
- No more in-memory vs SQL inconsistencies

## 🔍 Debugging

### Check Service Logs
```bash
docker logs dinguscord-authentication-service-1
docker logs dinguscord-chat-room-service-1  
docker logs dinguscord-message-handling-service-1
```

### Check Database Content
```bash
# Connect to PostgreSQL
docker exec -it dinguscord-postgres-1 psql -U postgres

# List databases
\l

# Connect to specific database
\c auth
\c messages  
\c chatroom

# List tables
\dt

# Check users
SELECT username, display_name FROM users;

# Check rooms
SELECT id, name, created_by FROM rooms;

# Check room memberships  
SELECT room_id, user_id FROM room_memberships;
```

## 🚀 Architecture Benefits

This reset system tests our **improved architecture**:

**Before**: Messages (SQL) + Rooms (in-memory) = Data loss on restart
**After**: Messages (SQL) + Rooms (SQL) = Full persistence! 

**Production Ready!** 🎉 