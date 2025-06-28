import readline from 'readline';

console.log('Testing keyboard input...');
console.log('Press various keys to see what is detected.');
console.log('Press Ctrl+C to exit.\n');

// Enable keypress events
readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  console.log('You pressed:', {
    sequence: key.sequence,
    name: key.name,
    ctrl: key.ctrl,
    meta: key.meta,
    shift: key.shift
  });
  
  if (key.ctrl && key.name === 'c') {
    process.exit();
  }
});

console.log('Ready. Try pressing:');
console.log('- F1, F2, F3, etc.');
console.log('- Ctrl+A, Ctrl+L');
console.log('- Arrow keys');
console.log('- Regular letters\n');