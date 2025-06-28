# Shellington Script Commands

This guide explains all available npm scripts and command-line options.

## Development Scripts

### Starting Different Modes

```bash
# Terminal UI (default)
npm run dev
npm run dev:tui
npm run dev -- --tui

# API Server
npm run dev:api
npm run dev -- --api
npm run dev -- --api --port 8080 --host 0.0.0.0

# GUI (placeholder for future)
npm run dev:gui  # Shows "not yet implemented" message
npm run dev -- --gui

# Run multiple modes simultaneously
npm run dev:all  # Runs both TUI and API
```

### Production Scripts

```bash
# Build the TypeScript code
npm run build
npm run build:watch  # Watch mode

# Run from compiled JavaScript
npm start  # Defaults to TUI
npm run start:tui
npm run start:api
npm run start -- --api --port 8080
```

## Utility Scripts

### Command Execution

```bash
# Execute a single command
npm run exec -- "ls -la"
npm run exec -- "git status"

# With working directory
npx tsx core/index.ts exec "ls" -d /tmp
```

### History Management

```bash
# Search command history
npm run history
npm run history -- --keyword "git"
npm run history -- --limit 50
npm run history -- --failed  # Show only failed commands
npm run history -- --user john
```

### AI Assistant

```bash
# Query the AI
npm run ai -- "how do I find large files?"
npm run ai -- "explain the grep command" --explain
npm run ai -- "list all docker containers" --command
```

### Project Management

```bash
# Initialize Shellington configuration
npm run init

# Code quality
npm run lint
npm run typecheck

# Clean build artifacts
npm run clean
```

## Direct CLI Usage

You can also use the CLI directly with tsx:

```bash
# Main entry point with all options
npx tsx core/index.ts --help

# Subcommands
npx tsx core/index.ts shell
npx tsx core/index.ts server --port 3001
npx tsx core/index.ts exec "echo hello"
npx tsx core/index.ts history --keyword "npm"
npx tsx core/index.ts ai "explain chmod"
npx tsx core/index.ts init
```

## Command-Line Options

### Global Options

- `--tui` - Start Terminal UI (default if no mode specified)
- `--api` - Start API server
- `--gui` - Start GUI (not yet implemented)
- `-p, --port <port>` - API server port (default: 3001)
- `--host <host>` - API server host (default: localhost)
- `-V, --version` - Show version
- `-h, --help` - Show help

### Subcommand Options

#### `exec` Command
- `-d, --directory <path>` - Working directory for command execution

#### `history` Command
- `-k, --keyword <keyword>` - Search by keyword
- `-n, --limit <number>` - Limit results (default: 20)
- `-u, --user <user>` - Filter by user
- `--failed` - Show only failed commands

#### `ai` Command
- `-c, --command` - Convert query to command
- `-e, --explain` - Explain the last command

#### `server` Command
- `-p, --port <port>` - Server port (default: 3001)
- `--host <host>` - Server host (default: localhost)

## Environment Variables

Scripts respect these environment variables:

```bash
# API Configuration
ANTHROPIC_API_KEY=your-key
JWT_SECRET=your-secret
SHELLINGTON_API_PORT=3001
SHELLINGTON_API_HOST=localhost

# UI Configuration
SHELLINGTON_UI_URL=http://localhost:3000

# Feature Flags
SHELLINGTON_NO_AI=true  # Disable AI features
```

## Examples

### Development Workflow

```bash
# 1. Start development with auto-reload
npm run dev:tui

# 2. In another terminal, start the API
npm run dev:api

# 3. Or run both at once
npm run dev:all
```

### Production Deployment

```bash
# 1. Build the project
npm run build

# 2. Run in production
NODE_ENV=production npm start -- --api --port 80
```

### Quick Tasks

```bash
# Check git status across multiple repos
for dir in */; do
  echo "=== $dir ==="
  npm run exec -- "git status" -d "$dir"
done

# Find all npm commands you've run
npm run history -- --keyword "npm" --limit 100

# Get AI help for a complex task
npm run ai -- "create a bash script to backup all .env files"
```

## Tips

1. **Default Behavior**: Running `npm run dev` without flags starts the TUI
2. **Multiple Instances**: You can run multiple TUI instances in different terminals
3. **Remote Access**: Use `--host 0.0.0.0` to allow external connections to the API
4. **Custom Aliases**: Add your own aliases in package.json scripts section