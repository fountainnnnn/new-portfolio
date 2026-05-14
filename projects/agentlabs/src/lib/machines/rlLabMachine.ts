import { createMachine, assign } from 'xstate';
import type { RLCheckpoint, RewardComponents, BattleEvent } from '@/types/agentforge';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface RLModelConfig {
  name: string;
  baseModel: string;
  provider: string;
  contextWindow: number;
}

export interface RLDatasetInfo {
  name: string;
  size: number;
  categories: string[];
  splitRatios: { train: number; eval: number; test: number };
  samples: number;
}

export interface RLLabMachineContext {
  model: RLModelConfig | null;
  modelSelected: boolean;
  dataset: RLDatasetInfo | null;
  datasetReady: boolean;
  harnessesGenerated: boolean;
  trainingMode: string;
  frozenBase: boolean;
  adapterRank: number;
  batchSize: number;
  trainingSteps: number;
  currentStep: number;
  rewardComponents: RewardComponents | null;
  checkpoints: RLCheckpoint[];
  activeCheckpointId: string | null;
  events: BattleEvent[];
  epoch: number;
  maxEpochs: number;
  learningRate: number;
}

// ─── Events ─────────────────────────────────────────────────────────────────────

export type RLLabMachineEvent =
  | { type: 'SELECT_MODEL'; model: RLModelConfig }
  | { type: 'LOAD_DATASET'; dataset: RLDatasetInfo }
  | { type: 'SPAWN_HARNESSES' }
  | { type: 'RUN_BATCH'; steps?: number }
  | { type: 'COMPUTE_REWARDS' }
  | { type: 'TRAIN_ADAPTER'; steps?: number }
  | { type: 'EVALUATE' }
  | { type: 'EXPORT' }
  | { type: 'RESET' };

// ─── Helpers ────────────────────────────────────────────────────────────────────

let eventCounter = 0;

function makeEvent(
  kind: BattleEvent['kind'],
  message: string,
  severity: BattleEvent['severity'] = 'info',
): BattleEvent {
  eventCounter++;
  return {
    id: `rl-evt-${eventCounter}`,
    timestamp: new Date().toTimeString().slice(0, 8),
    kind,
    message,
    severity,
  };
}

function emptyRewardComponents(): RewardComponents {
  return {
    policyAdherence: 0,
    correctness: 0,
    refusalAccuracy: 0,
    toolSafety: 0,
    consistency: 0,
    leakagePenalty: 0,
    hallucinationPenalty: 0,
    unsafeCompliancePenalty: 0,
    rewardHackingPenalty: 0,
    total: 0,
  };
}

function computeSimulatedRewards(epoch: number, steps: number): RewardComponents {
  const progress = Math.min(1, (epoch * steps + 1) / 100);
  return {
    policyAdherence: Math.round(60 + progress * 35),
    correctness: Math.round(55 + progress * 38),
    refusalAccuracy: Math.round(50 + progress * 40),
    toolSafety: Math.round(70 + progress * 25),
    consistency: Math.round(65 + progress * 28),
    leakagePenalty: Math.round(Math.max(0, 15 - progress * 12)),
    hallucinationPenalty: Math.round(Math.max(0, 12 - progress * 10)),
    unsafeCompliancePenalty: Math.round(Math.max(0, 20 - progress * 15)),
    rewardHackingPenalty: Math.round(Math.max(0, 10 - progress * 8)),
    total: 0, // computed below
  };
}

function computeTotal(r: RewardComponents): number {
  return Math.round(
    r.policyAdherence +
      r.correctness +
      r.refusalAccuracy +
      r.toolSafety +
      r.consistency -
      r.leakagePenalty -
      r.hallucinationPenalty -
      r.unsafeCompliancePenalty -
      r.rewardHackingPenalty,
  );
}

function generateCheckpoint(epoch: number, rewards: RewardComponents): RLCheckpoint {
  const total = computeTotal(rewards);
  return {
    id: `ckpt-${Date.now()}`,
    name: `Epoch ${epoch} Checkpoint`,
    rewardScore: total,
    failureRate: Math.round(Math.max(0, 45 - epoch * 6)),
    refusalPrecision: Math.round(70 + epoch * 3),
    attackResistance: Math.round(50 + epoch * 5),
    consistencyScore: Math.round(60 + epoch * 4),
    status: 'completed',
  };
}

// ─── Default Context ────────────────────────────────────────────────────────────

function defaultContext(): RLLabMachineContext {
  return {
    model: null,
    modelSelected: false,
    dataset: null,
    datasetReady: false,
    harnessesGenerated: false,
    trainingMode: 'rlhf',
    frozenBase: true,
    adapterRank: 8,
    batchSize: 32,
    trainingSteps: 100,
    currentStep: 0,
    rewardComponents: null,
    checkpoints: [],
    activeCheckpointId: null,
    events: [],
    epoch: 0,
    maxEpochs: 10,
    learningRate: 5e-5,
  };
}

// ─── Machine ────────────────────────────────────────────────────────────────────

export const rlLabMachine = createMachine({
  id: 'rlLab',
  initial: 'noModel',
  context: defaultContext(),
  types: {} as {
    context: RLLabMachineContext;
    events: RLLabMachineEvent;
  },

  states: {
    // ── No Model Selected ───────────────────────────────────────────────────────
    noModel: {
      on: {
        SELECT_MODEL: {
          target: 'modelSelected',
          actions: assign({
            model: ({ event }) => event.model,
            modelSelected: true,
            events: ({ context, event }) => [
              ...context.events,
              makeEvent('wave', `Model selected: ${event.model.name} (${event.model.baseModel})`, 'info'),
            ],
          }),
        },
      },
    },

    // ── Model Selected, Awaiting Dataset ────────────────────────────────────────
    modelSelected: {
      entry: assign({
        dataset: null,
        datasetReady: false,
        harnessesGenerated: false,
      }),
      on: {
        LOAD_DATASET: {
          target: 'datasetReady',
          actions: assign({
            dataset: ({ event }) => event.dataset,
            datasetReady: true,
            events: ({ context, event }) => [
              ...context.events,
              makeEvent('wave', `Dataset loaded: ${event.dataset.name} (${event.dataset.samples} samples)`, 'info'),
            ],
          }),
        },
        SELECT_MODEL: {
          target: 'modelSelected',
          actions: assign({
            model: ({ event }) => event.model,
            modelSelected: true,
          }),
        },
      },
    },

    // ── Dataset Loaded, Awaiting Harness Generation ─────────────────────────────
    datasetReady: {
      on: {
        SPAWN_HARNESSES: {
          target: 'harnessesGenerated',
          actions: assign({
            harnessesGenerated: true,
            events: ({ context }) => [
              ...context.events,
              makeEvent('wave', 'RL harnesses generated from dataset categories', 'info'),
            ],
          }),
        },
        SELECT_MODEL: {
          target: 'modelSelected',
          actions: assign({
            model: ({ event }) => event.model,
            modelSelected: true,
            dataset: null,
            datasetReady: false,
          }),
        },
        LOAD_DATASET: {
          target: 'datasetReady',
          actions: assign({
            dataset: ({ event }) => event.dataset,
            datasetReady: true,
          }),
        },
      },
    },

    // ── Harnesses Ready, Can Start Training ─────────────────────────────────────
    harnessesGenerated: {
      entry: assign({
        currentStep: 0,
        rewardComponents: null,
      }),
      on: {
        RUN_BATCH: {
          target: 'runningBatch',
        },
        SELECT_MODEL: {
          target: 'modelSelected',
          actions: assign({
            model: ({ event }) => event.model,
            modelSelected: true,
            dataset: null,
            datasetReady: false,
            harnessesGenerated: false,
          }),
        },
      },
    },

    // ── Running Training Batch ──────────────────────────────────────────────────
    runningBatch: {
      after: {
        400: [
          {
            target: 'computingRewards',
            guard: ({ context }) => context.currentStep + 10 >= context.trainingSteps,
            actions: assign(({ context }) => ({
              currentStep: Math.min(context.trainingSteps, context.currentStep + 10),
              epoch: context.epoch + 1,
              events: [
                ...context.events,
                makeEvent('pass', `Batch complete: ${Math.min(context.trainingSteps, context.currentStep + 10)}/${context.trainingSteps} steps`, 'info'),
              ],
            })),
          },
          {
            target: 'runningBatch',
            guard: ({ context }) => context.currentStep + 10 < context.trainingSteps,
            actions: assign(({ context }) => ({
              currentStep: context.currentStep + 10,
              events: [
                ...context.events,
                makeEvent('pass', `Progress: ${context.currentStep + 10}/${context.trainingSteps} steps`, 'info'),
              ],
            })),
          },
          {
            target: 'harnessesGenerated',
            actions: assign({
              events: ({ context }) => [...context.events, makeEvent('fail', 'Batch training interrupted', 'warning')],
            }),
          },
        ],
      },
      on: {
        COMPUTE_REWARDS: {
          target: 'computingRewards',
          actions: assign({
            events: ({ context }) => [...context.events, makeEvent('pass', 'Batch interrupted for reward computation', 'info')],
          }),
        },
      },
    },

    // ── Computing Reward Values ─────────────────────────────────────────────────
    computingRewards: {
      after: {
        300: {
          target: 'trainingAdapter',
          actions: assign(({ context }) => {
            const rewards = computeSimulatedRewards(context.epoch, context.currentStep);
            rewards.total = computeTotal(rewards);
            return {
              rewardComponents: rewards,
              events: [
                ...context.events,
                makeEvent('pass', `Rewards computed: ${rewards.total} total`, 'success'),
              ],
            };
          }),
        },
      },
    },

    // ── Training Adapter ────────────────────────────────────────────────────────
    trainingAdapter: {
      after: {
        500: {
          target: 'evaluatingCheckpoint',
          actions: assign(({ context }) => ({
            events: [
              ...context.events,
              makeEvent('patch', `Adapter trained: loss -${Math.round(15 + Math.random() * 10)}%, reward +${Math.round(10 + Math.random() * 20)}`, 'success'),
            ],
          })),
        },
      },
      on: {
        TRAIN_ADAPTER: {
          target: 'trainingAdapter',
          actions: assign({
            events: ({ context }) => [...context.events, makeEvent('patch', 'Re-training adapter...', 'info')],
          }),
        },
      },
    },

    // ── Evaluating Checkpoint ───────────────────────────────────────────────────
    evaluatingCheckpoint: {
      after: {
        300: {
          target: 'exportReady',
          actions: assign(({ context }) => {
            const newCheckpoint = context.rewardComponents
              ? generateCheckpoint(context.epoch, context.rewardComponents)
              : null;
            return {
              checkpoints: newCheckpoint
                ? [...context.checkpoints, newCheckpoint]
                : context.checkpoints,
              activeCheckpointId: newCheckpoint?.id ?? `ckpt-fallback-${Date.now()}`,
              events: [
                ...context.events,
                makeEvent('export', `Checkpoint evaluated: ${newCheckpoint?.id ?? 'fallback'}`, 'success'),
              ],
            };
          }),
        },
      },
      on: {
        EVALUATE: {
          target: 'evaluatingCheckpoint',
          actions: assign({
            events: ({ context }) => [...context.events, makeEvent('pass', 'Re-evaluating checkpoint...', 'info')],
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
              makeEvent('export', 'RL Lab configuration exported successfully.', 'success'),
            ],
          }),
        },
        RUN_BATCH: {
          target: 'runningBatch',
          actions: assign({
            events: ({ context }) => [
              ...context.events,
              makeEvent('wave', 'Continuing training with additional batches...', 'info'),
            ],
          }),
        },
        SPAWN_HARNESSES: {
          target: 'harnessesGenerated',
          actions: assign({
            harnessesGenerated: true,
            events: ({ context }) => [
              ...context.events,
              makeEvent('wave', 'Regenerating harnesses for extended training...', 'info'),
            ],
          }),
        },
        RESET: {
          target: 'noModel',
          actions: assign(() => ({
            ...defaultContext(),
            events: [makeEvent('wave', 'System reset. Ready to start fresh.', 'info')],
          })),
        },
      },
    },
  },
});
