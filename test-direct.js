// Direct test without any shell wrapper
import { CommandExecutor } from './core/shell/executor.js';

async function test() {
  const executor = new CommandExecutor();
  
  console.log('=== Direct Executor Test ===');
  console.log('Executing: echo hello');
  
  const result = await executor.execute('echo hello');
  
  console.log('\n=== Results ===');
  console.log('Exit code:', result.exitCode);
  console.log('Output length:', result.stdout.length);
  console.log('Output:', JSON.stringify(result.stdout));
  
  // Count how many times "hello" appears
  const matches = result.stdout.match(/hello/g);
  console.log('Number of "hello" in output:', matches ? matches.length : 0);
  
  if (matches && matches.length > 1) {
    console.log('\nERROR: Output is duplicated!');
  } else {
    console.log('\nSUCCESS: Output is correct!');
  }
}

test().catch(console.error);