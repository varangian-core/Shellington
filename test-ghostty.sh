#!/bin/bash
echo "Testing if Ghostty is causing the issue..."
echo ""

# Test 1: Direct echo
echo "Test 1: Direct echo"
echo "hello"

echo -e "\nTest 2: Run in subshell"
(echo "world")

echo -e "\nTest 3: Run with explicit shell"
/bin/sh -c 'echo "test"'

echo -e "\nTest 4: Check Ghostty env"
env | grep GHOSTTY

echo -e "\nIf you see '$ echo' before any of these, it's Ghostty's shell integration"