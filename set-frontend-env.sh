#!/bin/bash

cd DingusGui/DingusMessaging

cat > .env.development << EOF
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3003
EOF

echo "Frontend environment variables set successfully" 