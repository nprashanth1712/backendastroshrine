#!/bin/sh
# AstroShrine Backend Startup Script
# Creates Firebase service account file from environment variable

echo "🚀 Starting AstroShrine Backend..."

# Create Firebase service account file from environment variable
if [ -n "$FIREBASE_SERVICE_ACCOUNT" ]; then
    echo "📝 Creating Firebase service account file..."
    echo "$FIREBASE_SERVICE_ACCOUNT" > serviceAccKey.json
    echo "✅ Firebase credentials configured"
else
    echo "⚠️  Warning: FIREBASE_SERVICE_ACCOUNT not set - push notifications will not work"
    echo "{}" > serviceAccKey.json
fi

# Start the Node.js server
echo "🌐 Starting server on port ${PORT:-5050}..."
exec node dist/src/index.js
