#!/bin/bash

# Deployment Script for cPanel
# This script should be placed on your cPanel server

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Configuration - UPDATE THESE VALUES
APP_DIR="/home/YOUR_CPANEL_USERNAME/YOUR_APP_FOLDER"
APP_NAME="dsscreen-backend"
NODE_ENV="production"

# Navigate to app directory
cd "$APP_DIR"

echo "📦 Installing dependencies..."
npm install --production

echo "🗄️  Running database migrations..."
npm run migrate:run || echo "⚠️  Migration failed or no migrations to run"

echo "🔄 Restarting application..."

# Check if PM2 is installed (recommended)
if command -v pm2 &> /dev/null; then
    echo "Using PM2 for process management..."
    pm2 restart "$APP_NAME" || pm2 start index.js --name "$APP_NAME" --env "$NODE_ENV"
    pm2 save
else
    echo "Using pkill/nohup for process management..."
    # Kill existing process
    pkill -f "node.*index.js" || true
    
    # Wait for process to stop
    sleep 2
    
    # Start new process in background
    NODE_ENV="$NODE_ENV" nohup node index.js > app.log 2>&1 &
    
    echo "Application started with PID: $!"
fi

echo "✅ Deployment completed successfully!"
echo "📝 Check logs at: $APP_DIR/app.log"
echo "🌿 Branch: test_host (testing environment)"

