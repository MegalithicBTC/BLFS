#!/bin/sh
# Purpose: dev-friendly start. Installs deps, then launches TS server.
set -e
cd /workspace

# Always run npm install (fast when up-to-date)
npm install --no-audit --no-fund

# Check Litestream configuration and start if configured
if [ -n "$LITESTREAM_REPLICA_URL" ]; then
    echo "Litestream replica URL configured: $LITESTREAM_REPLICA_URL"
    echo "Starting Litestream replication in background..."
    litestream replicate -config /etc/litestream.yml &
    echo "Database replication enabled"
else
    echo "No Litestream replica URL configured - running without database replication"
fi

# Launch TypeScript server
exec ts-node ./src/index.ts
