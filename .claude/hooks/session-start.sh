#!/bin/bash
set -euo pipefail

# Only run this hook in remote Claude Code environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

# Install dependencies
npm install

# Start the development server in background
npm run dev -- --host &

# Wait a moment for the server to start
sleep 3
