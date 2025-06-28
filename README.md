# Shellington - AI-Powered Shell with Remote UI

Shellington is an advanced shell application that combines the power of a traditional command-line interface with modern features including AI integration, comprehensive command history, and a secure remote UI.

## Features

- **Powerful Command Execution**: Full shell capabilities with piping, redirection, and environment variable support
- **AI Assistant Integration**: Built-in AI assistant for command suggestions, error analysis, and natural language queries
- **Persistent History**: SQLite-backed command history with search and statistics
- **Terminal UI (TUI)**: Beautiful blessed-based terminal interface with history sidebar
- **Remote UI**: Secure web-based UI for remote command execution
- **Real-time Communication**: WebSocket-based communication for live command output

## Installation

```bash
npm install
```

## Usage

### Interactive Shell (TUI)

Start the interactive shell with the terminal UI:

```bash
npm run dev:core
# or
node core/index.js shell
```

### Command Line Interface

Execute single commands:

```bash
node core/index.js exec "ls -la"
```

Search command history:

```bash
node core/index.js history --keyword "git" --limit 10
```

Query the AI assistant:

```bash
node core/index.js ai "how do I find large files?"
```

### Remote API Server

Start the API server for remote UI connections:

```bash
node core/index.js server --port 3001
```

## TUI Keyboard Shortcuts

- `Ctrl+A`: Toggle AI mode
- `Ctrl+L`: Clear screen
- `Ctrl+C` or `q`: Exit
- `Up/Down`: Navigate command history
- `Enter`: Execute command

## Configuration

Initialize Shellington configuration:

```bash
node core/index.js init
```

This creates a configuration file at `~/.shellington/config.json`.

## Environment Variables

- `ANTHROPIC_API_KEY`: API key for AI assistant
- `JWT_SECRET`: Secret for JWT token generation
- `SHELLINGTON_UI_URL`: URL of the remote UI (default: http://localhost:3000)
- `SHELLINGTON_NO_AI`: Set to 'true' to disable AI features

## Architecture

- **Core Shell**: Command execution engine with history management
- **AI Assistant**: Anthropic Claude integration for intelligent assistance
- **API Server**: Express + Socket.IO server for remote access
- **TUI**: Blessed-based terminal interface
- **Remote UI**: (To be implemented) React-based web interface

## Security

- JWT-based authentication for remote connections
- TLS support for secure communication
- Command whitelisting/blacklisting (planned)

## Development

Build the TypeScript code:

```bash
npm run build:core
```

Run tests:

```bash
npm test
```

## License

MIT
