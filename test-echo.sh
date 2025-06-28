#!/bin/bash
echo "Test 1: Basic echo"
echo "hello"

echo -e "\nTest 2: Echo with command substitution"
output=$(echo "world")
echo "Output: $output"

echo -e "\nTest 3: Direct shell execution"
/bin/sh -c 'echo "direct"'

echo -e "\nTest 4: Check for duplicate processes"
ps aux | grep -E "(echo|sh)" | grep -v grep

echo -e "\nIf you see any output duplicated above, the issue is NOT with Shellington"