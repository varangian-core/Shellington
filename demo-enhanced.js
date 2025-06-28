import { startEnhancedREPL } from './core/ui/enhanced-repl.js';
import { CommandExecutor } from './core/shell/executor.js';
import { HistoryManager } from './core/history/manager.js';

// Demo script to showcase enhanced REPL features
async function demo() {
  console.log('Starting Enhanced REPL Demo...\n');
  console.log('This demonstrates the split view with current execution and history.\n');
  console.log('Features:');
  console.log('- Split view: Current command execution on left (60%), history on right (40%)');
  console.log('- F2: Toggle between split and focused views');
  console.log('- Real-time execution updates');
  console.log('- Visual indicators for running commands\n');
  
  console.log('Try these commands:');
  console.log('1. ls -la          (see files with execution time)');
  console.log('2. sleep 3         (watch the timer update in real-time)');
  console.log('3. Press F2        (toggle to focused view)');
  console.log('4. history         (see full command history)');
  console.log('5. stats           (see shell statistics)\n');
  
  console.log('Starting in 3 seconds...');
  setTimeout(() => {
    startEnhancedREPL();
  }, 3000);
}

demo().catch(console.error);