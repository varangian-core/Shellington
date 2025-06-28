#!/bin/bash
echo "Testing Shellington simple mode directly..."
echo "Type 'echo test' and see if output is duplicated"
echo "Type 'exit' to quit"
echo ""

# Use npx tsx directly to avoid any shell nesting
npx tsx core/index.ts shell --simple