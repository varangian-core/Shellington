#!/bin/bash
# Clean test in a new shell environment

echo "=== Clean Shellington Test ==="
echo "Starting in a clean environment..."
echo ""

# Ensure we're not in any special mode
set +x
unset SHELLINGTON_ACTIVE

# Run Shellington
exec npx tsx core/index.ts shell --simple