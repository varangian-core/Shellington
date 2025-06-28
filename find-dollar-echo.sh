#!/bin/bash
echo "Searching for where '$ command' is printed..."
echo ""

echo "=== In simple-repl.ts ==="
grep -n "\\$" core/ui/simple-repl.ts | grep -v "chalk.green"

echo -e "\n=== Searching for console.log with $ ==="
grep -rn "console.log.*\\$" core/

echo -e "\n=== Searching for process.stdout.write with $ ==="
grep -rn "process.stdout.write.*\\$" core/