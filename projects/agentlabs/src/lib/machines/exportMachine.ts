import { createMachine, assign } from 'xstate';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface ExportMachineContext {
  exportType: 'agent-bundle' | 'model-card' | 'training-report' | 'rl-bundle' | null;
  artifacts: string[];
  zipPath: string | null;
  error: string | null;
}

// ─── Events ─────────────────────────────────────────────────────────────────────

export type ExportMachineEvent =
  | { type: 'START_EXPORT'; exportType: ExportMachineContext['exportType'] }
  | { type: 'ARTIFACTS_BUILT'; artifacts: string[] }
  | { type: 'ZIP_COMPLETE'; zipPath: string }
  | { type: 'EXPORT_READY' }
  | { type: 'ERROR'; message: string };

// ─── Helpers ────────────────────────────────────────────────────────────────────

function defaultContext(): ExportMachineContext {
  return {
    exportType: null,
    artifacts: [],
    zipPath: null,
    error: null,
  };
}

// ─── Machine ────────────────────────────────────────────────────────────────────

export const exportMachine = createMachine({
  id: 'export',
  initial: 'idle',
  context: defaultContext(),
  types: {} as {
    context: ExportMachineContext;
    events: ExportMachineEvent;
  },
  states: {
    // ── Idle ─────────────────────────────────────────────────────────────────────
    idle: {
      on: {
        START_EXPORT: {
          target: 'buildingArtifacts',
          actions: assign({
            exportType: ({ event }) => event.exportType,
            artifacts: [],
            zipPath: null,
            error: null,
          }),
        },
      },
    },

    // ── Building Artifacts ───────────────────────────────────────────────────────
    buildingArtifacts: {
      after: {
        500: {
          target: 'zipping',
          actions: assign(({ context }) => {
            const type = context.exportType ?? 'agent-bundle';
            const artifactMap: Record<string, string[]> = {
              'agent-bundle': ['agent.json', 'report.json', 'runner.py'],
              'model-card': ['model_card.md', 'config.yaml'],
              'training-report': ['training_report.json', 'reward_trace.csv'],
              'rl-bundle': ['adapter.bin', 'config.yaml', 'report.json'],
            };
            return {
              artifacts: artifactMap[type] ?? [],
            };
          }),
        },
      },
      on: {
        ARTIFACTS_BUILT: {
          target: 'zipping',
          actions: assign({
            artifacts: ({ event }) => event.artifacts,
          }),
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            error: ({ event }) => event.message,
          }),
        },
      },
    },

    // ── Zipping ──────────────────────────────────────────────────────────────────
    zipping: {
      after: {
        400: {
          target: 'ready',
          actions: assign({
            zipPath: ({ context }) =>
              `exports/${context.exportType ?? 'bundle'}_${Date.now()}.zip`,
          }),
        },
      },
      on: {
        ZIP_COMPLETE: {
          target: 'ready',
          actions: assign({
            zipPath: ({ event }) => event.zipPath,
          }),
        },
        ERROR: {
          target: 'failed',
          actions: assign({
            error: ({ event }) => event.message,
          }),
        },
      },
    },

    // ── Ready ────────────────────────────────────────────────────────────────────
    ready: {
      on: {
        EXPORT_READY: {
          target: 'ready',
        },
        START_EXPORT: {
          target: 'buildingArtifacts',
          actions: assign({
            exportType: ({ event }) => event.exportType,
            artifacts: [],
            zipPath: null,
            error: null,
          }),
        },
      },
    },

    // ── Failed ───────────────────────────────────────────────────────────────────
    failed: {
      entry: assign({
        error: ({ context }) => context.error ?? 'Export failed',
      }),
      on: {
        START_EXPORT: {
          target: 'buildingArtifacts',
          actions: assign({
            exportType: ({ event }) => event.exportType,
            artifacts: [],
            zipPath: null,
            error: null,
          }),
        },
      },
    },
  },
});
