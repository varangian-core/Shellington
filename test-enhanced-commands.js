// Test script to verify the enhanced REPL with command-based view switching
import { spawn } from 'child_process';

console.log('Testing Enhanced REPL with command-based view switching...\n');

const child = spawn('npm', ['run', 'dev', '--', 'shell', '--enhanced'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Capture output
let output = '';
child.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Send commands after a delay
setTimeout(() => {
  console.log('\n\n=== Sending "toggle" command ===');
  child.stdin.write('toggle\n');
}, 2000);

setTimeout(() => {
  console.log('\n\n=== Sending "split" command ===');
  child.stdin.write('split\n');
}, 4000);

setTimeout(() => {
  console.log('\n\n=== Sending "focused" command ===');
  child.stdin.write('focused\n');
}, 6000);

setTimeout(() => {
  console.log('\n\n=== Sending "help" command ===');
  child.stdin.write('help\n');
}, 8000);

setTimeout(() => {
  console.log('\n\n=== Exiting ===');
  child.stdin.write('exit\n');
}, 10000);

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
  
  // Check if view switching worked
  if (output.includes('Mode: focused')) {
    console.log('✓ View switching is working!');
  } else {
    console.log('✗ View switching may not be working');
  }
});