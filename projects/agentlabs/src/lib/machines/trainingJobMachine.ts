import { createMachine, assign } from 'xstate';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface TrainingJobContext {
  modelConfig: {
    baseModel: string;
    adapterRank: number;
    batchSize: number;
    learningRate: number;
    loraAlpha: number;
    loraTargetModules: string[];
  } | null;
  trainingSteps: number;
  currentStep: number;
  rewards: number[];
  checkpoints: Array<{
    id: string;
    step: number;
    reward: number;
    path: string;
  }>;
  errors: string[];
}

// ─── Events ─────────────────────────────────────────────────────────────────────

export type TrainingJobEvent =
  | { type: 'START_TRAINING'; config: TrainingJobContext['modelConfig'] }
  | { type: 'MODEL_VALIDATED' }
  | { type: 'MODEL_LOADED' }
  | { type: 'DATASET_READY' }
  | { type: 'BASE_FROZEN' }
  | { type: 'TRAINING_STEP_COMPLETE'; step: number; reward: number }
  | { type: 'CHECKPOINT_SAVED'; checkpointId: string; step: number; reward: number; path: string }
  | { type: 'EVALUATION_COMPLETE'; finalReward: number }
  | { type: 'TRAINING_COMPLETE' }
  | { type: 'ERROR'; message: string };

// ─── Helpers ────────────────────────────────────────────────────────────────────

function defaultContext(): TrainingJobContext {
  return {
    modelConfig: null,
    trainingSteps: 1000,
    currentStep: 0,
    rewards: [],
    checkpoints: [],
    errors: [],
  };
}

// ─── Machine ────────────────────────────────────────────────────────────────────

export const trainingJobMachine = createMachine({
  id: 'trainingJob',
  initial: 'idle',
  context: defaultContext(),
  types: {} as {
    context: TrainingJobContext;
    events: TrainingJobEvent;
  },
  states: {
    // ── Idle — waiting to start ──────────────────────────────────────────────────
    idle: {
      on: {
        START_TRAINING: {
          target: 'validatingModel',
          actions: assign({
            modelConfig: ({ event }) => event.config,
            trainingSteps: ({ event }) => event.config?.batchSize != null ? 1000 : 1000,
            currentStep: 0,
            rewards: [],
            checkpoints: [],
            errors: [],
          }),
        },
      },
    },

    // ── Validating Model ─────────────────────────────────────────────────────────
    validatingModel: {
      after: {
        600: {
          target: 'loadingModel',
          actions: assign({
            errors: ({ context }) => {
              // Simulate validation — clear errors if valid
              return context.errors.filter((e) => !e.startsWith('Validation'));
            },
          }),
        },
      },
      on: {
        MODEL_VALIDATED: {
          target: 'loadingModel',
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            errors: ({ context, event }) => [...context.errors, event.message],
          }),
        },
      },
    },

    // ── Loading Model ────────────────────────────────────────────────────────────
    loadingModel: {
      after: {
        800: {
          target: 'preparingDataset',
        },
      },
      on: {
        MODEL_LOADED: {
          target: 'preparingDataset',
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            errors: ({ context, event }) => [...context.errors, event.message],
          }),
        },
      },
    },

    // ── Preparing Dataset ────────────────────────────────────────────────────────
    preparingDataset: {
      after: {
        500: {
          target: 'freezingBase',
        },
      },
      on: {
        DATASET_READY: {
          target: 'freezingBase',
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            errors: ({ context, event }) => [...context.errors, event.message],
          }),
        },
      },
    },

    // ── Freezing Base Model ──────────────────────────────────────────────────────
    freezingBase: {
      after: {
        400: {
          target: 'trainingAdapter',
        },
      },
      on: {
        BASE_FROZEN: {
          target: 'trainingAdapter',
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            errors: ({ context, event }) => [...context.errors, event.message],
          }),
        },
      },
    },

    // ── Training Adapter ─────────────────────────────────────────────────────────
    trainingAdapter: {
      initial: 'stepping',
      states: {
        stepping: {
          after: {
            300: [
              {
                target: 'saving',
                guard: ({ context }) =>
                  context.currentStep + 1 >= (context.trainingSteps ?? 1000),
                actions: assign(({ context }) => {
                  const newStep = Math.min(
                    context.trainingSteps ?? 1000,
                    context.currentStep + 1,
                  );
                  const reward = Math.round(
                    (50 + Math.random() * 40) * (newStep / (context.trainingSteps ?? 1000)),
                  );
                  return {
                    currentStep: newStep,
                    rewards: [...context.rewards, reward],
                  };
                }),
              },
              {
                target: 'stepping',
                actions: assign(({ context }) => {
                  const newStep = context.currentStep + 1;
                  const reward = Math.round(
                    (50 + Math.random() * 40) * (newStep / (context.trainingSteps ?? 1000)),
                  );
                  return {
                    currentStep: newStep,
                    rewards: [...context.rewards, reward],
                  };
                }),
              },
            ],
          },
          on: {
            TRAINING_STEP_COMPLETE: {
              actions: assign({
                currentStep: ({ event }) => event.step,
                rewards: ({ context, event }) => [...context.rewards, event.reward],
              }),
            },
            ERROR: {
              target: '#trainingJob.failed',
              actions: assign({
                errors: ({ context, event }) => [...context.errors, event.message],
              }),
            },
          },
        },
        saving: {
          after: {
            200: {
              target: '#trainingJob.evaluating',
              actions: assign(({ context }) => {
                const lastReward =
                  context.rewards.length > 0
                    ? context.rewards[context.rewards.length - 1]
                    : 0;
                const checkpoint = {
                  id: `ckpt-${Date.now()}`,
                  step: context.currentStep,
                  reward: lastReward,
                  path: `checkpoints/step_${context.currentStep}.pt`,
                };
                return {
                  checkpoints: [...context.checkpoints, checkpoint],
                };
              }),
            },
          },
          on: {
            CHECKPOINT_SAVED: {
              target: '#trainingJob.evaluating',
              actions: assign({
                checkpoints: ({ context, event }) => [
                  ...context.checkpoints,
                  {
                    id: event.checkpointId,
                    step: event.step,
                    reward: event.reward,
                    path: event.path,
                  },
                ],
              }),
            },
            ERROR: {
              target: '#trainingJob.failed',
              actions: assign({
                errors: ({ context, event }) => [...context.errors, event.message],
              }),
            },
          },
        },
      },
      on: {
        ERROR: {
          target: 'failed',
          actions: assign({
            errors: ({ context, event }) => [...context.errors, event.message],
          }),
        },
      },
    },

    // ── Evaluating ───────────────────────────────────────────────────────────────
    evaluating: {
      after: {
        700: {
          target: 'completed',
          actions: assign({
            rewards: ({ context }) => {
              const finalReward =
                context.rewards.length > 0
                  ? Math.round(
                      context.rewards[context.rewards.length - 1] *
                        (0.9 + Math.random() * 0.2),
                    )
                  : 0;
              return [...context.rewards, finalReward];
            },
          }),
        },
      },
      on: {
        EVALUATION_COMPLETE: {
          target: 'completed',
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            errors: ({ context, event }) => [...context.errors, event.message],
          }),
        },
      },
    },

    // ── Completed ────────────────────────────────────────────────────────────────
    completed: {
      type: 'final',
      entry: assign({
        errors: ({ context }) =>
          context.errors.length === 0
            ? context.errors
            : [...context.errors, 'Training completed with warnings'],
      }),
    },

    // ── Failed ───────────────────────────────────────────────────────────────────
    failed: {
      entry: assign({
        errors: ({ context }) => [...context.errors, 'Training job failed'],
      }),
    },
  },
});
