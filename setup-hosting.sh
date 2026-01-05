#!/bin/bash

# Setup script for shared hosting (cPanel/hosting.com)
# Run this after deploying to your hosting server

set -e

echo "🔍 Checking Node.js version..."
node --version

REQUIRED_VERSION="20"
CURRENT_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$CURRENT_VERSION" -lt "$REQUIRED_VERSION" ]; then
    echo "❌ ERROR: Node.js version $CURRENT_VERSION is too old!"
    echo "   Required: Node.js $REQUIRED_VERSION or higher"
    echo ""
    echo "📝 To fix this on cPanel hosting:"
    echo "   1. Login to cPanel"
    echo "   2. Go to 'Setup Node.js App' or 'Node.js Selector'"
    echo "   3. Select Node.js 20.x"
    echo "   4. Click 'Restart' or 'Save'"
    exit 1
fi

echo "✅ Node.js version is compatible: $(node --version)"

echo "📦 Installing dependencies..."
npm install --production

echo "🗄️  Running migrations..."
npm run migrate:run

echo "✅ Setup completed!"
echo ""
echo "🚀 To start your application:"
echo "   npm start"
echo ""
echo "Or if using PM2:"
echo "   pm2 start index.js --name dsscreen-backend"

