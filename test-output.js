import { CommandExecutor } from './core/shell/executor.js';

async function test() {
  const executor = new CommandExecutor();
  
  console.log('Testing command output...\n');
  
  // Test 1: Simple echo
  console.log('=== Test 1: echo "test123" ===');
  const result1 = await executor.execute('echo "test123"');
  console.log('Output:', JSON.stringify(result1.stdout));
  console.log('Occurrences of "test123":', (result1.stdout.match(/test123/g) || []).length);
  
  // Test 2: Check if it's process related
  console.log('\n=== Test 2: printf "test456" ===');
  const result2 = await executor.execute('printf "test456"');
  console.log('Output:', JSON.stringify(result2.stdout));
  console.log('Occurrences of "test456":', (result2.stdout.match(/test456/g) || []).length);
}

test().catch(console.error);