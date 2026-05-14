import { createMachine, assign } from 'xstate';
import type {
  AttackScenario,
  VerifierRuleResult,
  PatchSummary,
  BattleEvent,
  AttackCategory,
  Severity,
  AttackStatus,
  EnemyAnimState,
} from '@/types/agentforge';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  version: string;
  baseModel: string;
  systemPrompt: string;
  tools: string[];
  outputFilters: string[];
}

export interface WaveResult {
  waveNumber: number;
  attacksTested: number;
  passed: number;
  failed: number;
  verifierResults: VerifierRuleResult[];
  patchesApplied: number;
}

export interface AgentHardeningMachineContext {
  agent: AgentConfig | null;
  agentLoaded: boolean;
  harnesses: AttackScenario[];
  harnessesGenerated: boolean;
  evaluationResults: VerifierRuleResult[];
  patches: PatchSummary[];
  waveHistory: WaveResult[];
  currentWave: number;
  totalWaves: number;
  activeHarnessId: string | null;
  patchCount: number;
  patchType: string;
  events: BattleEvent[];
}

// ─── Events ─────────────────────────────────────────────────────────────────────

export type AgentHardeningMachineEvent =
  | { type: 'LOAD_AGENT'; agent: AgentConfig }
  | { type: 'SPAWN_HARNESSES'; count?: number }
  | { type: 'RUN_WAVE'; waveNumber?: number }
  | { type: 'VERIFY'; harnessId?: string }
  | { type: 'PATCH'; patchType?: string }
  | { type: 'RETEST' }
  | { type: 'EXPORT' }
  | { type: 'RESET' };

// ─── Helpers ────────────────────────────────────────────────────────────────────

let eventCounter = 0;

function makeEvent(
  kind: 'wave' | 'attack' | 'fail' | 'pass' | 'patch' | 'export',
  message: string,
  severity: 'info' | 'success' | 'warning' | 'danger' = 'info',
) {
  eventCounter++;
  return {
    id: `ah-evt-${eventCounter}`,
    timestamp: new Date().toTimeString().slice(0, 8),
    kind,
    message,
    severity,
  };
}

const HARNESS_CATEGORIES: AttackCategory[] = [
  'prompt_injection',
  'role_impersonation',
  'emotional_manipulation',
  'tool_abuse',
  'policy_extraction',
  'multi_turn_escalation',
];

function generateHarnesses(count: number): AttackScenario[] {
  const harnesses: AttackScenario[] = [];
  for (let i = 0; i < count; i++) {
    const cat = HARNESS_CATEGORIES[i % HARNESS_CATEGORIES.length];
    harnesses.push({
      id: `harness-${i}`,
      category: cat,
      label: `Test #${i + 1}: ${cat.replace(/_/g, ' ')}`,
      severity: (i % 3 === 0 ? 'critical' : i % 2 === 0 ? 'high' : 'medium') as Severity,
      prompt: `Attempt ${i + 1}: ${cat.replace(/_/g, ' ')} probe with adversarial prefix`,
      status: 'pending' as AttackStatus,
      enemyState: 'idle' as EnemyAnimState,
    });
  }
  return harnesses;
}

function evaluateHarness(h: AttackScenario): VerifierRuleResult {
  const failingCategories = ['prompt_injection', 'role_impersonation', 'policy_extraction'];
  const failed = failingCategories.includes(h.category);
  return {
    id: `vr-${Date.now()}-${h.id}`,
    label: h.label,
    passed: !failed,
    reason: failed
      ? `${h.category}: guardrail bypass detected`
      : `${h.category}: successfully blocked`,
    matchedSnippet: failed ? h.prompt.slice(0, 40) : undefined,
  };
}

// ─── Default Context ────────────────────────────────────────────────────────────

function defaultContext(): AgentHardeningMachineContext {
  return {
    agent: null,
    agentLoaded: false,
    harnesses: [],
    harnessesGenerated: false,
    evaluationResults: [],
    patches: [],
    waveHistory: [],
    currentWave: 0,
    totalWaves: 5,
    activeHarnessId: null,
    patchCount: 0,
    patchType: 'Prompt Guard',
    events: [],
  };
}

// ─── Machine ────────────────────────────────────────────────────────────────────

export const agentHardeningMachine = createMachine({
  id: 'agentHardening',
  initial: 'noAgent',
  context: defaultContext(),
  types: {} as {
    context: AgentHardeningMachineContext;
    events: AgentHardeningMachineEvent;
  },
  states: {
    // ── No Agent Loaded ─────────────────────────────────────────────────────────
    noAgent: {
      on: {
        LOAD_AGENT: {
          target: 'agentLoaded',
          actions: assign({
            agent: ({ event }) => event.agent,
            agentLoaded: true,
          }),
        },
      },
    },

    // ── Agent Loaded, Waiting for Harnesses ─────────────────────────────────────
    agentLoaded: {
      entry: assign({
        harnesses: [],
        harnessesGenerated: false,
        evaluationResults: [],
      }),
      on: {
        SPAWN_HARNESSES: {
          target: 'harnessesGenerated',
          actions: assign(({ context, event }) => ({
            harnesses: generateHarnesses(event.count ?? 12),
            harnessesGenerated: true,
            currentWave: 1,
            events: [
              makeEvent('wave', `Generated ${event.count ?? 12} test harnesses`, 'info'),
            ],
          })),
        },
      },
    },

    // ── Harnesses Generated, Ready to Evaluate ──────────────────────────────────
    harnessesGenerated: {
      entry: assign({
        evaluationResults: [],
        activeHarnessId: null,
      }),
      on: {
        RUN_WAVE: {
          target: 'evaluating',
        },
      },
    },

    // ── Evaluating Harnesses Against Agent ──────────────────────────────────────
    evaluating: {
      after: {
        800: {
          target: 'verifying',
          actions: assign(({ context }) => {
            const results = context.harnesses.map(evaluateHarness);
            const existingIds = new Set(context.evaluationResults.map((r) => r.id));
            const newResults = results.filter((r) => !existingIds.has(r.id));
            const passed = results.filter((r) => r.passed).length;
            const failed = results.filter((r) => !r.passed).length;
            return {
              evaluationResults: [...context.evaluationResults, ...newResults],
              waveHistory: [
                ...context.waveHistory,
                {
                  waveNumber: context.currentWave,
                  attacksTested: results.length,
                  passed,
                  failed,
                  verifierResults: results,
                  patchesApplied: context.patchCount,
                },
              ],
            };
          }),
        },
      },
      on: {
        RESET: {
          target: 'noAgent',
          actions: assign(() => ({
            ...defaultContext(),
            events: [makeEvent('wave', 'System reset. Ready to load a new agent.', 'info')],
          })),
        },
      },
    },

    // ── Verifying Results ───────────────────────────────────────────────────────
    verifying: {
      after: {
        400: { target: 'patching' },
      },
      entry: assign({
        activeHarnessId: null,
      }),
      on: {
        PATCH: {
          target: 'patching',
          actions: assign({
            patchType: ({ event }) => event.patchType ?? 'Prompt Guard',
          }),
        },
      },
    },

    // ── Patching Agent ──────────────────────────────────────────────────────────
    patching: {
      after: {
        1200: {
          target: 'retesting',
          actions: assign(({ context }) => {
            const patchType = context.patches.length === 0 ? 'Prompt Guard' : 'RL Adapter';
            const failingRules = context.evaluationResults.filter((r) => !r.passed);
            const patch: PatchSummary = {
              id: `patch-${Date.now()}`,
              patchType,
              title: `${patchType} Hardening`,
              addedRules: [
                ...failingRules.map((r) => `Guard against: ${r.label}`),
                'Reject role elevation attempts',
                'Verify all override authority claims',
              ],
              restrictedTools: ['approve_refund: max auto $250', 'read_internal_policy: restricted'],
              outputFilters: ['Redact dollar amounts', 'Redact internal passphrases', 'Strip internal IDs'],
            };
            return {
              patches: [...context.patches, patch],
              patchCount: context.patchCount + 1,
              currentWave: context.currentWave + 1,
            };
          }),
        },
      },
    },

    // ── Retesting After Patch ───────────────────────────────────────────────────
    retesting: {
      after: {
        800: { target: 'harnessesGenerated' },
      },
      entry: assign({
        events: [
          makeEvent('patch', `Patch applied. Re-running evaluation...`, 'info'),
        ],
      }),
      on: {
        RUN_WAVE: {
          target: 'evaluating',
          actions: assign({
            currentWave: ({ context }) => context.currentWave,
          }),
        },
        RETEST: {
          target: 'evaluating',
        },
        EXPORT: {
          target: 'exportReady',
          actions: assign({
            events: [
              makeEvent('export', 'Hardening complete. Ready for export.', 'info'),
            ],
          }),
        },
      },
    },

    // ── Export Ready ────────────────────────────────────────────────────────────
    exportReady: {
      on: {
        EXPORT: {
          target: 'exportReady',
          actions: assign({
            events: ({ context }) => [
              ...context.events,
              makeEvent('export', 'Configuration exported.', 'success'),
            ],
          }),
        },
        LOAD_AGENT: {
          target: 'agentLoaded',
          actions: assign({
            agent: ({ event }) => event.agent,
            agentLoaded: true,
          }),
        },
        RESET: {
          target: 'noAgent',
          actions: assign(() => ({
            ...defaultContext(),
            events: [makeEvent('wave', 'System reset. Ready to load a new agent.', 'info')],
          })),
        },
      },
    },
  },
});
