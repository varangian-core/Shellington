import { CommandExecutor } from './core/shell/executor.js';

async function test() {
  console.log('Testing command executor...');
  const executor = new CommandExecutor();
  
  console.log('\n--- Executing: echo test ---');
  const result = await executor.execute('echo test');
  
  console.log('\n--- Result ---');
  console.log('stdout:', JSON.stringify(result.stdout));
  console.log('stderr:', JSON.stringify(result.stderr));
  console.log('exitCode:', result.exitCode);
}

test().catch(console.error);