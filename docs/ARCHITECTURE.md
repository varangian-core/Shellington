# Shellington Architecture

## Overview

Shellington is designed as a modular, extensible shell application with AI capabilities and remote access. The architecture follows a layered approach with clear separation of concerns.

```
┌─────────────────────┐     ┌─────────────────────┐
│   Remote UI (Web)   │     │    Terminal UI      │
│      (React)        │     │     (Blessed)       │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │ WebSocket/HTTP            │ Direct
           │                           │
┌──────────▼──────────────────────────▼──────────┐
│                 API Server                      │
│              (Express + Socket.IO)              │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                Core Shell Layer                 │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
│  │  Command    │  │   History    │  │   AI   │ │
│  │  Executor   │  │   Manager    │  │Assistant│ │
│  └─────────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              System Resources                   │
│         (File System, Processes, Network)       │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. Command Executor (`core/shell/executor.ts`)

Responsible for executing shell commands with proper handling of:
- Process spawning with correct shell selection
- Environment variable management
- Working directory tracking
- Real-time output streaming
- Error handling and exit codes

**Key Features:**
- Platform-agnostic (Windows/Unix)
- Maintains session state (cwd, env)
- Captures stdout/stderr separately
- Measures execution duration

### 2. History Manager (`core/history/manager.ts`)

Manages persistent command history using SQLite:
- Stores all executed commands with metadata
- Provides search and filtering capabilities
- Generates usage statistics
- Maintains indexes for performance

**Database Schema:**
```sql
CREATE TABLE command_history (
  id INTEGER PRIMARY KEY,
  command TEXT NOT NULL,
  exit_code INTEGER NOT NULL,
  stdout TEXT,
  stderr TEXT,
  timestamp DATETIME,
  working_directory TEXT,
  user TEXT,
  duration INTEGER
);
```

### 3. AI Assistant (`core/ai/assistant.ts`)

Integrates with Anthropic's Claude API to provide:
- Natural language to command conversion
- Error analysis and suggestions
- Command explanations
- Interactive chat capabilities

**Request Flow:**
1. User input → AI Request builder
2. Context enrichment (last command, cwd)
3. API call with appropriate system prompt
4. Response parsing and command extraction

### 4. Terminal UI (`core/ui/tui.ts`)

Built with Blessed.js, provides:
- Split-pane interface (output + history)
- Real-time command execution
- AI mode toggle
- Keyboard navigation
- Status bar with context

**Layout:**
```
┌─────────────────────────┬──────────────┐
│                         │              │
│     Command Output      │   History    │
│        (70%)           │    (30%)     │
│                         │              │
├─────────────────────────┴──────────────┤
│  Mode | Directory | Help               │
├────────────────────────────────────────┤
│ > command prompt                       │
└────────────────────────────────────────┘
```

### 5. API Server (`core/api/server.ts`)

Provides remote access through:
- REST endpoints for history and stats
- WebSocket for real-time command execution
- JWT-based authentication
- Session management per connection

**Security Layers:**
1. JWT token validation
2. Permission checking
3. Rate limiting (planned)
4. Command whitelisting (planned)

## Data Flow

### Command Execution Flow

```
User Input → TUI/API → Command Executor → System Shell
                ↓                              ↓
           History Manager              Output Stream
                ↓                              ↓
            SQLite DB                    User Display
```

### AI Assistance Flow

```
User Query → AI Assistant → Anthropic API
                ↓                ↓
          Context Builder   Response Parser
                ↓                ↓
          Enhanced Query    Command/Suggestion
```

## Type System

Shared types (`shared/types.ts`) ensure consistency:

```typescript
interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timestamp: Date;
  workingDirectory: string;
  user: string;
  duration: number;
}
```

## Security Architecture

### Authentication
- JWT tokens with configurable expiration
- API key validation for token generation
- Session isolation per WebSocket connection

### Authorization
- Permission-based access control
- Command execution restrictions
- Resource access limitations

### Data Protection
- Command history encrypted at rest (planned)
- Secure credential storage (planned)
- Audit logging for all operations

## Extensibility Points

### 1. Plugin System (Planned)
```typescript
interface Plugin {
  name: string;
  version: string;
  onCommand?: (cmd: string) => CommandResult;
  onPreExecute?: (cmd: string) => string;
  onPostExecute?: (result: CommandResult) => void;
}
```

### 2. Custom AI Providers
The AI assistant is designed to support multiple providers:
```typescript
interface AIProvider {
  processRequest(request: AIRequest): Promise<AIResponse>;
}
```

### 3. Storage Backends
History storage can be extended beyond SQLite:
```typescript
interface HistoryBackend {
  addEntry(result: CommandResult): Promise<number>;
  search(options: SearchOptions): Promise<CommandHistoryEntry[]>;
}
```

## Performance Considerations

### 1. Database Optimization
- Indexes on frequently queried fields
- Prepared statements for common queries
- Connection pooling for concurrent access

### 2. Real-time Communication
- WebSocket for low-latency updates
- Event-based architecture
- Minimal data serialization

### 3. Memory Management
- Stream processing for large outputs
- Garbage collection hints
- Resource cleanup on disconnect

## Future Enhancements

### 1. Distributed Architecture
- Multiple shell nodes
- Centralized history
- Load balancing

### 2. Advanced Security
- 2FA support
- Hardware token integration
- Encrypted command streams

### 3. Enhanced AI
- Local LLM support
- Custom training on user patterns
- Predictive command completion

## Development Guidelines

### Code Organization
```
/core
  /shell      - Command execution logic
  /history    - History management
  /ai         - AI integration
  /api        - REST/WebSocket server
  /ui         - Terminal interface
/shared       - Common types and utilities
/ui           - Web-based remote UI
/docs         - Documentation
/tests        - Test suites
```

### Testing Strategy
1. Unit tests for core components
2. Integration tests for API
3. E2E tests for user flows
4. Performance benchmarks

### Contributing
1. Follow TypeScript best practices
2. Maintain type safety
3. Document public APIs
4. Include tests for new features