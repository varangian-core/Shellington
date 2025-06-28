# Shellington API Documentation

The Shellington API provides secure remote access to shell functionality through WebSocket and REST endpoints.

## Authentication

All API requests require JWT authentication.

### Obtaining a Token

```bash
POST /auth/token
Content-Type: application/json

{
  "apiKey": "your-32-character-api-key"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2024-06-29T12:00:00Z"
}
```

### Using the Token

Include the token in the Authorization header for REST requests:
```
Authorization: Bearer <token>
```

For WebSocket connections, pass it in the auth object:
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'your-token' }
});
```

## REST Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### Command History

```
GET /api/history?keyword=git&limit=20&offset=0
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": 1,
    "command": "git status",
    "exitCode": 0,
    "stdout": "On branch main...",
    "stderr": "",
    "timestamp": "2024-06-28T10:00:00Z",
    "workingDirectory": "/home/user/project",
    "user": "user",
    "duration": 125
  }
]
```

### History Statistics

```
GET /api/history/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "totalCommands": 1523,
  "successfulCommands": 1456,
  "failedCommands": 67,
  "mostUsedCommands": [
    {"command": "git status", "count": 234},
    {"command": "ls -la", "count": 189}
  ]
}
```

## WebSocket Events

### Connection

```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'your-token' },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to Shellington');
});

socket.on('error', (error) => {
  console.error('Connection error:', error);
});
```

### Execute Command

```javascript
socket.emit('execute', {
  id: 'unique-command-id',
  command: 'ls -la',
  workingDirectory: '/home/user', // optional
  environment: { // optional
    'CUSTOM_VAR': 'value'
  }
}, (response) => {
  if (response.error) {
    console.error('Execution error:', response.error);
  } else {
    console.log('Result:', response.result);
  }
});
```

Response:
```javascript
{
  result: {
    commandId: 'unique-command-id',
    command: 'ls -la',
    exitCode: 0,
    stdout: 'total 48\ndrwxr-xr-x...',
    stderr: '',
    timestamp: '2024-06-28T10:00:00Z',
    workingDirectory: '/home/user',
    user: 'user',
    duration: 45
  }
}
```

### Real-time Output

```javascript
socket.on('output', (data) => {
  console.log(`Command ${data.commandId}: ${data.type}`);
  if (data.type === 'stdout') {
    process.stdout.write(data.data);
  } else if (data.type === 'stderr') {
    process.stderr.write(data.data);
  }
});
```

### AI Queries

```javascript
socket.emit('ai', {
  type: 'natural-to-command',
  query: 'find all log files larger than 100MB',
  context: {
    workingDirectory: '/var/log'
  }
}, (response) => {
  if (response.error) {
    console.error('AI error:', response.error);
  } else {
    console.log('AI response:', response.response);
  }
});
```

AI Request Types:
- `natural-to-command`: Convert natural language to shell command
- `error-analysis`: Analyze command errors
- `explain`: Explain a command
- `chat`: General conversation

### Change Directory

```javascript
socket.emit('cd', '/home/user/projects', (response) => {
  if (response.error) {
    console.error('CD error:', response.error);
  } else {
    console.log('New directory:', response.cwd);
  }
});
```

### Get Environment Info

```javascript
socket.emit('env', (response) => {
  console.log('Current directory:', response.cwd);
  console.log('Environment:', response.env);
});
```

## Error Handling

All errors follow this format:
```json
{
  "error": "Error message description"
}
```

Common error codes:
- `401`: Authentication required or invalid token
- `403`: Permission denied
- `404`: Resource not found
- `500`: Internal server error

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Authentication: 5 requests per minute
- Command execution: 60 requests per minute
- AI queries: 30 requests per minute

## Security Considerations

1. **Always use HTTPS in production**
2. **Keep your JWT secret secure**
3. **Implement IP whitelisting for production**
4. **Use strong API keys (32+ characters)**
5. **Monitor command execution logs**
6. **Consider command whitelisting for restricted environments**

## Example: Node.js Client

```javascript
const io = require('socket.io-client');
const axios = require('axios');

class ShellingtonClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.token = null;
    this.socket = null;
  }

  async connect() {
    // Get auth token
    const response = await axios.post(`${this.apiUrl}/auth/token`, {
      apiKey: this.apiKey
    });
    
    this.token = response.data.token;
    
    // Connect WebSocket
    this.socket = io(this.apiUrl, {
      auth: { token: this.token }
    });
    
    return new Promise((resolve, reject) => {
      this.socket.on('connect', resolve);
      this.socket.on('error', reject);
    });
  }

  execute(command) {
    return new Promise((resolve, reject) => {
      this.socket.emit('execute', {
        id: Date.now().toString(),
        command
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      });
    });
  }

  async getHistory(keyword) {
    const response = await axios.get(`${this.apiUrl}/api/history`, {
      params: { keyword },
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }
}

// Usage
const client = new ShellingtonClient('http://localhost:3001', 'your-api-key');
await client.connect();
const result = await client.execute('echo "Hello from Shellington!"');
console.log(result.stdout);
```