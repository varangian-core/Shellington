# Shellington Quick Start Guide 🚀

Welcome to Shellington! Get up and running in less than 5 minutes.

## 1. Install Dependencies

```bash
npm install
```

If you encounter SQLite build errors, see the troubleshooting section below.

## 2. Set Up Your Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
```

Don't have an API key? Get one at https://console.anthropic.com/

## 3. Start Shellington

### Option A: Interactive Terminal UI (Recommended for First Time)

```bash
npm run dev:tui
# OR
npm run dev -- --tui
# OR just
npm run dev
```

You'll see a beautiful terminal interface with:
- Main command area (left)
- Command history (right)
- Status bar (bottom)

Try these commands:
- Type `ls` and press Enter
- Press `Ctrl+A` to enable AI mode
- In AI mode, type: "show me all JavaScript files"
- Type `history` to see your command history
- Type `stats` to see usage statistics

### Option B: Quick Command Execution

```bash
# Execute a single command
npm run exec -- "echo Hello from Shellington!"

# Search your history
npm run history -- --keyword "git"

# Ask AI for help
npm run ai -- "how do I find large files?"
```

### Option C: Start the API Server

```bash
npm run dev:api
# OR
npm run dev -- --api
# OR with custom port
npm run dev -- --api --port 8080
```

The server will start on http://localhost:3001 (or your specified port)

### Option D: Run Multiple Modes

```bash
# Run both API and TUI in parallel
npm run dev:all
```

## 4. Essential Keyboard Shortcuts (TUI Mode)

- **Ctrl+A**: Toggle AI mode (cyan prompt = AI mode)
- **Up/Down**: Navigate command history
- **Ctrl+L**: Clear screen
- **Ctrl+C** or **q**: Exit

## 5. Cool Things to Try

### AI-Powered Commands

1. Enable AI mode (Ctrl+A) and try:
   - "find all PDF files modified this week"
   - "show me disk usage by directory"
   - "create a backup of my documents"

2. Get help with errors:
   - Run a command that fails
   - Press Ctrl+A
   - Type: "help me fix this error"

### Built-in Features

```bash
# View command history
history

# See your most used commands
stats

# Change directory (works like normal shell)
cd /path/to/directory
```

## Troubleshooting

### SQLite Build Errors

If npm install fails with SQLite errors:

**macOS:**
```bash
xcode-select --install
npm install
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install build-essential
npm install
```

**Windows:**
Install Visual Studio Build Tools, then:
```bash
npm install --global windows-build-tools
npm install
```

### AI Not Working?

1. Check your `.env` file has a valid API key
2. Ensure you have internet connection
3. Try a simple test: `npm run ai -- "hello"`

### Permission Errors?

```bash
# Fix history database permissions
mkdir -p ~/.shellington
chmod 755 ~/.shellington
```

## What's Next?

- Check out the [full documentation](./docs/GETTING_STARTED.md)
- Learn about the [API](./docs/API.md) for remote access
- Understand the [architecture](./docs/ARCHITECTURE.md)

## Need Help?

- Type `help` in the TUI
- Check the docs/ folder
- Report issues on GitHub

Enjoy using Shellington! 🐚✨