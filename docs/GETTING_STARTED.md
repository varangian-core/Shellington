# Getting Started with Shellington

This guide will help you set up and start using Shellington, the AI-powered shell with remote UI capabilities.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- An Anthropic API key (for AI features)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd Shellington
npm install
```

### 2. Configure Environment

Copy the example environment file and add your API key:

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 3. Initialize Shellington

```bash
npm run init
```

This creates the necessary configuration directory and files.

### 4. Start Using Shellington

#### Option A: Interactive Terminal UI (Recommended)

```bash
npm run dev:core
```

This launches the beautiful TUI with:
- Command execution pane
- History sidebar
- AI mode toggle (Ctrl+A)
- Real-time output

#### Option B: Command Line Mode

Execute single commands:
```bash
npx tsx core/index.ts exec "ls -la"
```

Search history:
```bash
npx tsx core/index.ts history --keyword "git"
```

Ask AI for help:
```bash
npx tsx core/index.ts ai "how do I find large files in my system?"
```

#### Option C: API Server for Remote Access

Start the server:
```bash
npx tsx core/index.ts server --port 3001
```

## Using the Terminal UI

### Navigation
- **Enter**: Execute command
- **Up/Down arrows**: Navigate command history
- **Ctrl+A**: Toggle AI mode
- **Ctrl+L**: Clear screen
- **Ctrl+U**: Clear current input line
- **Ctrl+R**: Reset input (emergency)
- **Ctrl+C**: Exit (press twice to confirm)
- **Ctrl+D**: Force exit
- **q**: Exit (in TUI mode, press twice)
- **exit** or **quit**: Exit command

### AI Mode

When AI mode is active (cyan prompt):
- Type natural language queries
- Ask for command suggestions: "run a command to find large files"
- Get error help: "fix the last error"
- Explain commands: "what does grep -r do?"

### Built-in Commands

- `history` - Show recent command history
- `stats` - Display command statistics
- `cd <path>` - Change directory
- `exit` or `quit` - Exit Shellington

## Features in Action

### 1. Natural Language to Command

```
AI> find all Python files modified in the last week
Suggested command: find . -name "*.py" -mtime -7
```

### 2. Error Analysis

When a command fails, press Ctrl+A and type:
```
AI> help me fix this error
```

### 3. Command History Search

```bash
# In TUI, just type:
history

# From CLI:
npx tsx core/index.ts history --keyword "docker" --limit 20
```

### 4. Remote Execution (via API)

Start the server and connect with a WebSocket client:
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('execute', {
  id: '123',
  command: 'ls -la'
}, (response) => {
  console.log(response.result);
});
```

## Troubleshooting

### SQLite Build Errors

If you encounter SQLite3 build errors:

1. Install build tools:
   - macOS: `xcode-select --install`
   - Ubuntu/Debian: `sudo apt-get install build-essential`
   - Windows: Install Visual Studio Build Tools

2. Clear npm cache and reinstall:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### AI Not Working

1. Check your API key in `.env`
2. Ensure you have internet connectivity
3. Verify the API key has sufficient credits

### Permission Errors

If you get permission errors for the history database:
```bash
mkdir -p ~/.shellington
chmod 755 ~/.shellington
```

## Next Steps

- Explore the [API Documentation](./API.md) for remote integration
- Check out [Advanced Usage](./ADVANCED.md) for power user features
- Learn about [Security Best Practices](./SECURITY.md)
- Contribute to the project on GitHub