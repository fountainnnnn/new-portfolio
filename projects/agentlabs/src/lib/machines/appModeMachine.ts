import { createMachine, assign } from 'xstate';
import type { AppMode } from '@/types/agentforge';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface AppModeMachineContext {
  currentMode: AppMode;
  previousMode: AppMode | null;
}

// ─── Events ─────────────────────────────────────────────────────────────────────

export type AppModeMachineEvent =
  | { type: 'GO_HOME' }
  | { type: 'GO_AGENT_HARDENING' }
  | { type: 'GO_RL_LAB' }
  | { type: 'GO_REPORTS' }
  | { type: 'GO_EXPORTS' };

// ─── Default Context ────────────────────────────────────────────────────────────

const defaultContext: AppModeMachineContext = {
  currentMode: 'home',
  previousMode: null,
};

// ─── Machine ────────────────────────────────────────────────────────────────────

export const appModeMachine = createMachine({
  id: 'appMode',
  initial: 'home',
  context: defaultContext,
  types: {} as {
    context: AppModeMachineContext;
    events: AppModeMachineEvent;
  },
  states: {
    home: {
      entry: assign({
        currentMode: 'home' as AppMode,
        previousMode: ({ context }) => context.currentMode as AppMode | null,
      }),
      on: {
        GO_AGENT_HARDENING: 'agentHardening',
        GO_RL_LAB: 'rlLab',
        GO_REPORTS: 'reports',
        GO_EXPORTS: 'exports',
      },
    },

    agentHardening: {
      entry: assign({
        currentMode: 'agentHardening' as AppMode,
        previousMode: ({ context }) => context.currentMode as AppMode | null,
      }),
      on: {
        GO_HOME: 'home',
        GO_RL_LAB: 'rlLab',
        GO_REPORTS: 'reports',
        GO_EXPORTS: 'exports',
      },
    },

    rlLab: {
      entry: assign({
        currentMode: 'rlLab' as AppMode,
        previousMode: ({ context }) => context.currentMode as AppMode | null,
      }),
      on: {
        GO_HOME: 'home',
        GO_AGENT_HARDENING: 'agentHardening',
        GO_REPORTS: 'reports',
        GO_EXPORTS: 'exports',
      },
    },

    reports: {
      entry: assign({
        currentMode: 'reports' as AppMode,
        previousMode: ({ context }) => context.currentMode as AppMode | null,
      }),
      on: {
        GO_HOME: 'home',
        GO_AGENT_HARDENING: 'agentHardening',
        GO_RL_LAB: 'rlLab',
        GO_EXPORTS: 'exports',
      },
    },

    exports: {
      entry: assign({
        currentMode: 'exports' as AppMode,
        previousMode: ({ context }) => context.currentMode as AppMode | null,
      }),
      on: {
        GO_HOME: 'home',
        GO_AGENT_HARDENING: 'agentHardening',
        GO_RL_LAB: 'rlLab',
        GO_REPORTS: 'reports',
      },
    },
  },
});
