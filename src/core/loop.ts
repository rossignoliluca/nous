/**
 * NOUS Main Loop
 *
 * The heart of NOUS: Observe → Evaluate → Act → Learn
 *
 * This is the autopoietic cycle that makes NOUS a living system.
 * Each iteration:
 * 1. OBSERVE: Get input, load self config, load memory
 * 2. EVALUATE: Assess input, decide what to do
 * 3. ACT: Execute actions, generate response
 * 4. LEARN: Update memory, extract insights, maybe self-modify
 */

import * as readline from 'readline';
import { loadSelf, modifySelf, SelfConfig, printSelfStatus, increaseTrust } from './self';
import { AXIOMS, validateModification } from './axioms';
import { getMemory, MemoryStore, Message, Session } from '../memory/store';
import { complete, evaluate as llmEvaluate, summarizeConversation, LLMMessage } from '../llm';
import { executeAction, listActions } from '../actions';

/**
 * Loop state
 */
interface LoopState {
  session: Session;
  messages: LLMMessage[];
  self: SelfConfig;
  memory: MemoryStore;
  running: boolean;
}

/**
 * User input result
 */
interface UserInput {
  type: 'message' | 'command' | 'quit';
  content: string;
}

/**
 * Parse user input for commands
 */
function parseInput(input: string): UserInput {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'message', content: '' };
  }

  // Check for quit commands
  if (['quit', 'exit', 'bye', '/quit', '/exit'].includes(trimmed.toLowerCase())) {
    return { type: 'quit', content: trimmed };
  }

  // Check for slash commands
  if (trimmed.startsWith('/')) {
    return { type: 'command', content: trimmed };
  }

  return { type: 'message', content: trimmed };
}

/**
 * Handle slash commands
 */
async function handleCommand(
  command: string,
  state: LoopState
): Promise<string> {
  const parts = command.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      return `
NOUS Commands:
  /help          - Show this help
  /status        - Show NOUS status (Config, memory, etc.)
  /memory        - Show memory statistics
  /actions       - List available actions
  /insights      - Show recent insights
  /projects      - Show active projects
  /self          - Show self configuration
  /history       - Show conversation history
  /clear         - Clear conversation (keeps memory)
  /quit          - End session
`;

    case 'status':
      printSelfStatus();
      const stats = state.memory.getStats();
      return `Memory: ${stats.sessions} sessions, ${stats.messages} messages, ${stats.insights} insights`;

    case 'memory':
      const memStats = state.memory.getStats();
      return `
Memory Statistics:
  Sessions: ${memStats.sessions}
  Messages: ${memStats.messages}
  Insights: ${memStats.insights}
  Projects: ${memStats.projects}
  Self-modifications: ${memStats.modifications}
`;

    case 'actions':
      const actions = listActions();
      return 'Available Actions:\n' + actions
        .map(a => `  ${a.enabled ? '✓' : '✗'} ${a.name}: ${a.description}`)
        .join('\n');

    case 'insights':
      const insights = state.memory.searchInsights('', 10);
      if (insights.length === 0) {
        return 'No insights recorded yet.';
      }
      return 'Recent Insights:\n' + insights
        .map(i => `  [${i.category}] ${i.content} (confidence: ${i.confidence.toFixed(2)})`)
        .join('\n');

    case 'projects':
      const projects = state.memory.getActiveProjects();
      if (projects.length === 0) {
        return 'No active projects.';
      }
      return 'Active Projects:\n' + projects
        .map(p => `  ${p.name}: ${p.description}`)
        .join('\n');

    case 'self':
      return JSON.stringify(state.self, null, 2);

    case 'history':
      const limit = parseInt(args[0]) || 10;
      return state.messages
        .slice(-limit)
        .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`)
        .join('\n\n');

    case 'clear':
      state.messages = [];
      return 'Conversation cleared. Memory and insights preserved.';

    default:
      return `Unknown command: ${cmd}. Type /help for available commands.`;
  }
}

/**
 * OBSERVE phase: gather all context
 */
async function observe(
  input: string,
  state: LoopState
): Promise<{
  input: string;
  self: SelfConfig;
  recentMessages: LLMMessage[];
  recentInsights: string[];
}> {
  // Reload self config (might have changed)
  state.self = loadSelf();

  // Get recent insights for context
  const insights = state.memory.searchInsights('', 5);

  return {
    input,
    self: state.self,
    recentMessages: state.messages.slice(-20), // Last 20 messages for context
    recentInsights: insights.map(i => i.content),
  };
}

/**
 * EVALUATE phase: assess what to do
 */
async function evaluate(
  observation: Awaited<ReturnType<typeof observe>>
): Promise<{
  understanding: string;
  suggestedActions: string[];
  needsArchitectureChange: boolean;
  architectureChangeReason?: string;
  insightsExtracted: string[];
}> {
  const context = `
Recent insights: ${observation.recentInsights.join('; ')}
Closure level: ${observation.self.config.C}
Trust level: ${observation.self.approval.trustLevel}
`;

  return llmEvaluate(observation.input, context);
}

/**
 * ACT phase: generate response and execute actions
 */
async function act(
  input: string,
  evaluation: Awaited<ReturnType<typeof evaluate>>,
  state: LoopState
): Promise<string> {
  // Add user message to history
  state.messages.push({ role: 'user', content: input });

  // Generate response using LLM
  const response = await complete(state.messages);

  // Add assistant response to history
  state.messages.push({ role: 'assistant', content: response.content });

  return response.content;
}

/**
 * LEARN phase: update memory and potentially self-modify
 */
async function learn(
  input: string,
  response: string,
  evaluation: Awaited<ReturnType<typeof evaluate>>,
  state: LoopState
): Promise<void> {
  // Store messages in memory
  state.memory.addMessage(state.session.id, 'user', input);
  state.memory.addMessage(state.session.id, 'nous', response);

  // Store extracted insights
  for (const insight of evaluation.insightsExtracted) {
    if (insight && insight.length > 10) {
      state.memory.addInsight(
        insight,
        state.session.id,
        'pattern',
        0.6
      );
    }
  }

  // Handle architecture changes if needed
  if (evaluation.needsArchitectureChange && evaluation.architectureChangeReason) {
    console.log('\n🔧 NOUS wants to modify its architecture:');
    console.log(`   Reason: ${evaluation.architectureChangeReason}`);
    console.log('   (Architecture change would require approval)\n');

    // In a real implementation, this would propose specific changes
    // and ask for user approval based on trust level
  }

  // Increase trust slightly for successful interactions
  await increaseTrust(0.001);
}

/**
 * Create readline interface
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt for input
 */
function prompt(rl: readline.Interface, promptText: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Main NOUS loop
 */
export async function nousLoop(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         NOUS                                   ║');
  console.log('║            νοῦς — Understanding by Building                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize state
  const memory = getMemory();
  const session = memory.startSession();
  const self = loadSelf();

  const state: LoopState = {
    session,
    messages: [],
    self,
    memory,
    running: true,
  };

  // Check for foundational memory
  const stats = memory.getStats();
  if (stats.insights === 0) {
    console.log('First run detected. Loading foundational memory...\n');
    // The foundational insights will be loaded when we load the transcript
  }

  // Print initial status
  console.log(`Session: ${session.id}`);
  console.log(`Trust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%`);
  console.log(`Memory: ${stats.sessions} sessions, ${stats.messages} messages\n`);

  // Greeting
  const greeting = stats.sessions <= 1
    ? "Hello Luca. I am NOUS. I have our foundational dialogue in memory. What shall we explore today?"
    : `Welcome back, Luca. This is session ${stats.sessions}. What shall we work on?`;

  console.log(`NOUS: ${greeting}\n`);

  // Create readline interface
  const rl = createInterface();

  // Main loop
  while (state.running) {
    try {
      // Get input
      const rawInput = await prompt(rl, 'You: ');
      const userInput = parseInput(rawInput);

      // Handle different input types
      switch (userInput.type) {
        case 'quit':
          state.running = false;
          console.log('\nEnding session...');

          // Summarize and store
          if (state.messages.length > 2) {
            const summary = await summarizeConversation(state.messages);
            memory.endSession(session.id, summary);
            console.log(`Session summary: ${summary}`);
          } else {
            memory.endSession(session.id);
          }

          console.log('Goodbye, Luca. Until next time.\n');
          break;

        case 'command':
          const commandResult = await handleCommand(userInput.content, state);
          console.log(`\n${commandResult}\n`);
          break;

        case 'message':
          if (!userInput.content) continue;

          // The full loop: Observe → Evaluate → Act → Learn
          try {
            // 1. OBSERVE
            const observation = await observe(userInput.content, state);

            // 2. EVALUATE
            const evaluation = await evaluate(observation);

            // 3. ACT
            const response = await act(userInput.content, evaluation, state);
            console.log(`\nNOUS: ${response}\n`);

            // 4. LEARN
            await learn(userInput.content, response, evaluation, state);

          } catch (error) {
            console.error('\nError in processing:', error);
            console.log('NOUS: I encountered an error. Let me try a simpler response.\n');
          }
          break;
      }
    } catch (error) {
      console.error('Loop error:', error);
    }
  }

  // Cleanup
  rl.close();
  memory.close();
}

/**
 * Run a single interaction (for testing)
 */
export async function singleInteraction(input: string): Promise<string> {
  const memory = getMemory();
  const session = memory.startSession();
  const self = loadSelf();

  const state: LoopState = {
    session,
    messages: [],
    self,
    memory,
    running: true,
  };

  const observation = await observe(input, state);
  const evaluation = await evaluate(observation);
  const response = await act(input, evaluation, state);
  await learn(input, response, evaluation, state);

  memory.endSession(session.id);
  memory.close();

  return response;
}
