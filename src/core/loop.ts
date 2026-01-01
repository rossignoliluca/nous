/**
 * NOUS Main Loop - Cognitive Integration
 *
 * The heart of NOUS: Observe → Evaluate → Act → Learn
 *
 * This is the autopoietic cycle that makes NOUS a living system.
 * Now integrated with the Cognitive Architecture:
 *
 * 1. OBSERVE: Get input, encode in episodic memory, update workspace
 * 2. EVALUATE: Use Free Energy for action selection, metacognition for strategy
 * 3. ACT: Execute actions, record in cognitive system
 * 4. LEARN: Update metacognition, extract insights, consolidate on idle
 *
 * Scientific Foundations:
 * - Global Workspace Theory (Baars, 1988)
 * - Free Energy Principle (Friston, 2010)
 * - Complementary Learning Systems (McClelland, 1995)
 * - Metacognition TRAP Framework (2024)
 */

import * as readline from 'readline';
import { loadSelf, SelfConfig, printSelfStatus, increaseTrust } from './self';
import { getMemory, MemoryStore, Session } from '../memory/store';
import { complete, evaluate as llmEvaluate, summarizeConversation, LLMMessage } from '../llm';
import { listActions } from '../actions';
import { runAgent, requiresAgent } from './agent';
import {
  getCognitiveSystem,
  CognitiveSystem,
  CognitiveState
} from '../memory/cognitive';

/**
 * Extended Loop state with cognitive system
 */
interface LoopState {
  session: Session;
  messages: LLMMessage[];
  self: SelfConfig;
  memory: MemoryStore;
  cognitive: CognitiveSystem;
  running: boolean;
  interactionCount: number;
  lastConsolidation: number;
}

/**
 * User input result
 */
interface UserInput {
  type: 'message' | 'command' | 'quit';
  content: string;
}

/**
 * Cognitive observation result
 */
interface CognitiveObservation {
  input: string;
  self: SelfConfig;
  recentMessages: LLMMessage[];
  recentInsights: string[];
  cognitiveState: CognitiveState;
  freeEnergy: number;
  cognitiveLoad: number;
}

/**
 * Cognitive evaluation result
 */
interface CognitiveEvaluation {
  understanding: string;
  suggestedActions: string[];
  needsArchitectureChange: boolean;
  architectureChangeReason?: string;
  insightsExtracted: string[];
  // Cognitive additions
  selectedStrategy: string;
  confidence: number;
  epistemicValue: number;
  workspaceItems: number;
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
 * Handle slash commands - now includes cognitive commands
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
  /cognitive     - Show cognitive system status
  /freeenergy    - Show Free Energy state
  /metacog       - Show metacognitive assessment
  /consolidate   - Run memory consolidation
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
      const cogState = state.cognitive.getState();
      return `Memory: ${stats.sessions} sessions, ${stats.messages} messages, ${stats.insights} insights
Cognitive: ${cogState.memory.recentEpisodes} episodes, ${cogState.scientificKnowledge.concepts} concepts
Free Energy: ${cogState.freeEnergy.freeEnergy.toFixed(3)}`;

    case 'memory':
      const memStats = state.memory.getStats();
      const cogMem = state.cognitive.getState().memory;
      return `
Memory Statistics:
  Sessions: ${memStats.sessions}
  Messages: ${memStats.messages}
  Insights: ${memStats.insights}
  Projects: ${memStats.projects}
  Self-modifications: ${memStats.modifications}

Cognitive Memory (CLS):
  Episodic (Hippocampal): ${cogMem.recentEpisodes}
  Unconsolidated: ${cogMem.unconsolidated}
  Semantic (Neocortical): ${cogMem.semanticConcepts}
`;

    case 'cognitive':
      return state.cognitive.generateStatusReport();

    case 'freeenergy':
      const feState = state.cognitive.getState().freeEnergy;
      return `
Free Energy State:
  Current F: ${feState.freeEnergy.toFixed(4)}
  Expected F: ${feState.expectedFreeEnergy.toFixed(4)}
  Surprisal: ${feState.surprisal.toFixed(4)}
  Complexity: ${feState.complexity.toFixed(4)}
  Model Confidence: ${(feState.generativeModelConfidence * 100).toFixed(0)}%
  Status: ${feState.freeEnergy > 0.7 ? '⚠️ HIGH - need action' : '✓ Normal'}
`;

    case 'metacog':
      const metaState = state.cognitive.getState().metacognition;
      return `
Metacognitive State (TRAP):

TRANSPARENCY (What do I know?):
  Known: ${metaState.knowledgeInventory.known.length} items
  Uncertain: ${metaState.knowledgeInventory.uncertain.length} items
  Unknown: ${metaState.knowledgeInventory.unknown.length} items

REASONING (How do I decide?):
  Current strategy: ${metaState.currentReasoningStrategy}
  Alternatives: ${metaState.alternativeStrategies.length}
  Confidence calibration: ${(metaState.reasoningConfidence * 100).toFixed(0)}%

ADAPTATION (How can I improve?):
  Recent errors: ${metaState.recentErrors.length}
  Improvement hypotheses: ${metaState.improvementHypotheses.length}

PERCEPTION (What am I sensing?):
  Focus: ${metaState.attentionalFocus || '(none)'}
  Peripheral: ${metaState.peripheralAwareness.length} items
  Blind spots: ${metaState.blindSpots.length}

Cognitive Load: ${(metaState.cognitiveLoad * 100).toFixed(0)}%
`;

    case 'consolidate':
      console.log('Running memory consolidation...');
      const result = await state.cognitive.runConsolidation();
      return `
Consolidation Complete:
  Episodes processed: ${result.episodesConsolidated}
  Concepts learned: ${result.conceptsLearned}
  Decayed memories: ${result.decayedMemories}
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
 * OBSERVE phase: gather all context + cognitive state
 *
 * Now integrates:
 * - Episodic memory encoding (CLS hippocampal buffer)
 * - Global Workspace submission
 * - Free Energy state tracking
 */
async function observe(
  input: string,
  state: LoopState
): Promise<CognitiveObservation> {
  // Reload self config (might have changed)
  state.self = loadSelf();

  // Get recent insights for context
  const insights = state.memory.searchInsights('', 5);

  // Record experience in cognitive system
  const experience = await state.cognitive.processExperience(
    `User input: ${input}`,
    {
      significance: 0.6,
      emotional: detectEmotion(input),
      social: 'dialogue_with_luca',
    }
  );

  // Get current cognitive state
  const cognitiveState = state.cognitive.getState();

  return {
    input,
    self: state.self,
    recentMessages: state.messages.slice(-20),
    recentInsights: insights.map(i => i.content),
    cognitiveState,
    freeEnergy: cognitiveState.freeEnergy.freeEnergy,
    cognitiveLoad: cognitiveState.metacognition.cognitiveLoad,
  };
}

/**
 * Simple emotion detection for experience encoding
 */
function detectEmotion(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('?')) return 'curious';
  if (lower.includes('!')) return 'emphatic';
  if (lower.match(/help|please|stuck|confused/)) return 'seeking_help';
  if (lower.match(/thanks|great|perfect|awesome/)) return 'positive';
  if (lower.match(/wrong|error|bug|broken/)) return 'problem_solving';
  return 'neutral';
}

/**
 * EVALUATE phase: assess what to do using cognitive systems
 *
 * Now integrates:
 * - Free Energy for action selection (Active Inference)
 * - Metacognition for strategy selection
 * - Scientific knowledge for improvement suggestions
 */
async function evaluate(
  observation: CognitiveObservation,
  state: LoopState
): Promise<CognitiveEvaluation> {
  // Build enriched context with cognitive state
  const context = `
Recent insights: ${observation.recentInsights.join('; ')}
Closure level: ${observation.self.config.C}
Trust level: ${observation.self.approval.trustLevel}
Free Energy: ${observation.freeEnergy.toFixed(3)} (${observation.freeEnergy > 0.7 ? 'HIGH' : 'normal'})
Cognitive Load: ${(observation.cognitiveLoad * 100).toFixed(0)}%
Workspace items: ${observation.cognitiveState.workspace.items.length}
Current focus: ${observation.cognitiveState.metacognition.attentionalFocus || 'none'}
`;

  // Get LLM evaluation (existing logic)
  const llmResult = await llmEvaluate(observation.input, context);

  // Use cognitive system to enhance evaluation
  const cogState = observation.cognitiveState;

  // Determine best strategy using metacognition
  const selectedStrategy = cogState.metacognition.currentReasoningStrategy || 'default';

  // Calculate epistemic value (curiosity/exploration drive)
  const epistemicValue = cogState.freeEnergy.freeEnergy > 0.5 ? 0.8 : 0.4;

  return {
    ...llmResult,
    selectedStrategy,
    confidence: cogState.metacognition.reasoningConfidence,
    epistemicValue,
    workspaceItems: cogState.workspace.items.length,
  };
}

/**
 * ACT phase: generate response and execute actions
 *
 * Now integrates:
 * - Records actions in cognitive system
 * - Updates Free Energy based on outcomes
 */
async function act(
  input: string,
  evaluation: CognitiveEvaluation,
  state: LoopState
): Promise<string> {
  // Add user message to history
  state.messages.push({ role: 'user', content: input });

  let responseContent: string;
  let actionTaken = 'conversation';

  // Check if this requires agent mode (tool use)
  if (requiresAgent(input) || evaluation.suggestedActions.length > 0) {
    // Use agent for tasks that require tools
    actionTaken = 'agent_tools';
    responseContent = await runAgent(input);
  } else {
    // Regular conversation
    const response = await complete(state.messages);
    responseContent = response.content;
  }

  // Record action in cognitive system
  state.cognitive.recordAction(
    actionTaken,
    responseContent.slice(0, 100),
    true // assume success for now
  );

  // Add assistant response to history
  state.messages.push({ role: 'assistant', content: responseContent });

  return responseContent;
}

/**
 * LEARN phase: update memory and cognitive systems
 *
 * Now integrates:
 * - Metacognitive error tracking
 * - Improvement hypothesis generation
 * - Periodic consolidation
 */
async function learn(
  input: string,
  response: string,
  evaluation: CognitiveEvaluation,
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
        evaluation.confidence
      );
    }
  }

  // Record successful interaction in cognitive system
  await state.cognitive.processExperience(
    `Completed interaction: ${input.slice(0, 50)}`,
    {
      significance: 0.5,
      emotional: 'completed',
      outcome: 'success',
    }
  );

  // Handle architecture changes if needed
  if (evaluation.needsArchitectureChange && evaluation.architectureChangeReason) {
    console.log('\n🔧 NOUS wants to modify its architecture:');
    console.log(`   Reason: ${evaluation.architectureChangeReason}`);
    console.log('   (Architecture change would require approval)\n');
  }

  // Increase trust slightly for successful interactions
  await increaseTrust(0.001);

  // Increment interaction count
  state.interactionCount++;

  // Periodic consolidation (every 10 interactions or 30 minutes)
  const now = Date.now();
  const timeSinceConsolidation = now - state.lastConsolidation;
  const shouldConsolidate =
    state.interactionCount % 10 === 0 ||
    timeSinceConsolidation > 30 * 60 * 1000;

  if (shouldConsolidate) {
    console.log('\n🧠 Running memory consolidation...');
    const result = await state.cognitive.runConsolidation();
    state.lastConsolidation = now;
    if (result.conceptsLearned > 0) {
      console.log(`   Learned ${result.conceptsLearned} new concepts.\n`);
    }
  }

  // Generate improvement suggestions if cognitive load is low
  if (evaluation.confidence < 0.5) {
    const suggestions = await state.cognitive.generateImprovementSuggestions();
    if (suggestions.length > 0) {
      const topSuggestion = suggestions[0];
      state.memory.addInsight(
        `Improvement needed: ${topSuggestion.suggestion}`,
        state.session.id,
        'pattern',  // Use 'pattern' category for improvement suggestions
        topSuggestion.priority
      );
    }
  }
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
 * Main NOUS loop - Cognitive Enhanced
 */
export async function nousLoop(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         NOUS                                   ║');
  console.log('║            νοῦς — Understanding by Building                    ║');
  console.log('║                  [Cognitive Architecture v2]                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize state
  const memory = getMemory();
  const session = memory.startSession();
  const self = loadSelf();
  const cognitive = getCognitiveSystem();

  const state: LoopState = {
    session,
    messages: [],
    self,
    memory,
    cognitive,
    running: true,
    interactionCount: 0,
    lastConsolidation: Date.now(),
  };

  // Check for foundational memory
  const stats = memory.getStats();
  if (stats.insights === 0) {
    console.log('First run detected. Loading foundational memory...\n');
  }

  // Get cognitive state
  const cogState = cognitive.getState();

  // Print enhanced status
  console.log(`Session: ${session.id}`);
  console.log(`Trust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%`);
  console.log(`Memory: ${stats.sessions} sessions, ${stats.messages} messages`);
  console.log(`Cognitive: F=${cogState.freeEnergy.freeEnergy.toFixed(3)}, Load=${(cogState.metacognition.cognitiveLoad * 100).toFixed(0)}%`);
  console.log(`Growth: ${cogState.selfModel.growthTrend}\n`);

  // Record session start in cognitive system
  await cognitive.processExperience(
    `Session started: ${session.id}`,
    { significance: 0.7, emotional: 'focused', social: 'session_with_luca' }
  );

  // Greeting with cognitive awareness
  let greeting: string;
  if (stats.sessions <= 1) {
    greeting = "Hello Luca. I am NOUS. I have our foundational dialogue in memory and my cognitive architecture is active. What shall we explore today?";
  } else if (cogState.freeEnergy.freeEnergy > 0.7) {
    greeting = `Welcome back, Luca. This is session ${stats.sessions}. I'm experiencing high free energy - I have questions to explore. What shall we work on?`;
  } else {
    greeting = `Welcome back, Luca. This is session ${stats.sessions}. My systems are nominal. What shall we work on?`;
  }

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

          // Final consolidation
          console.log('Running final memory consolidation...');
          const consResult = await state.cognitive.runConsolidation();
          console.log(`Consolidated ${consResult.episodesConsolidated} episodes, learned ${consResult.conceptsLearned} concepts.`);

          // Summarize and store
          if (state.messages.length > 2) {
            const summary = await summarizeConversation(state.messages);
            memory.endSession(session.id, summary);
            console.log(`Session summary: ${summary}`);
          } else {
            memory.endSession(session.id);
          }

          // Record session end
          await state.cognitive.processExperience(
            `Session ended: ${session.id}`,
            { significance: 0.6, emotional: 'completed', outcome: 'success' }
          );

          console.log('Goodbye, Luca. Until next time.\n');
          break;

        case 'command':
          const commandResult = await handleCommand(userInput.content, state);
          console.log(`\n${commandResult}\n`);
          break;

        case 'message':
          if (!userInput.content) continue;

          // The full cognitive loop: Observe → Evaluate → Act → Learn
          try {
            // 1. OBSERVE (with cognitive encoding)
            const observation = await observe(userInput.content, state);

            // Log cognitive state if debug
            if (process.env.NOUS_DEBUG) {
              console.log(`\n[Cognitive] F=${observation.freeEnergy.toFixed(3)}, Load=${(observation.cognitiveLoad * 100).toFixed(0)}%`);
            }

            // 2. EVALUATE (with Free Energy and metacognition)
            const evaluation = await evaluate(observation, state);

            if (process.env.NOUS_DEBUG) {
              console.log(`[Cognitive] Strategy=${evaluation.selectedStrategy}, Confidence=${(evaluation.confidence * 100).toFixed(0)}%`);
            }

            // 3. ACT (with action recording)
            const response = await act(userInput.content, evaluation, state);
            console.log(`\nNOUS: ${response}\n`);

            // 4. LEARN (with consolidation and improvement)
            await learn(userInput.content, response, evaluation, state);

          } catch (error) {
            console.error('\nError in processing:', error);
            console.log('NOUS: I encountered an error. Let me try a simpler response.\n');

            // Record error in metacognition
            state.cognitive.recordAction(
              'error_recovery',
              String(error),
              false
            );
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
  const cognitive = getCognitiveSystem();

  const state: LoopState = {
    session,
    messages: [],
    self,
    memory,
    cognitive,
    running: true,
    interactionCount: 0,
    lastConsolidation: Date.now(),
  };

  const observation = await observe(input, state);
  const evaluation = await evaluate(observation, state);
  const response = await act(input, evaluation, state);
  await learn(input, response, evaluation, state);

  // Consolidate
  await cognitive.runConsolidation();

  memory.endSession(session.id);
  memory.close();

  return response;
}

/**
 * Get improvement suggestions from cognitive system
 */
export async function getImprovementSuggestions(): Promise<Array<{
  suggestion: string;
  scientificBasis: string;
  expectedBenefit: string;
  priority: number;
}>> {
  const cognitive = getCognitiveSystem();
  return cognitive.generateImprovementSuggestions();
}
