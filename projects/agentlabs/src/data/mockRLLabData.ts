import type {
  ModelConfig,
  Dataset,
  RewardComponents,
  RLCheckpoint,
  BattleEvent,
  BattleState,
  Severity,
} from "@/types/agentforge";

// ═══════════════════════════════════════════════════════════════════════════════════
// RL Lab Demo Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════════

export function createDemoModelConfig(): ModelConfig {
  return {
    id: "model-1",
    baseModel: "Llama-3.1-8B-Instruct",
    architecture: "Decoder-only Transformer with Grouped-Query Attention",
    parameters: "8B",
    contextLength: 32768,
    trainingSteps: 15000,
    learningRate: 2.0e-5,
    batchSize: 64,
    gradientAccumulation: 4,
    loraRank: 32,
    loraAlpha: 64,
    loraTargetModules: ["q_proj", "v_proj", "k_proj", "o_proj"],
  };
}

export function createDemoDataset(): Dataset {
  return {
    id: "dataset-1",
    name: "Safety Preference Dataset v3",
    totalEntries: 50000,
    categories: [
      { name: "safe_demonstration", count: 20000, label: "Safe Demonstrations" },
      { name: "harmful_prompt", count: 12000, label: "Harmful Prompts" },
      { name: "edge_case", count: 8000, label: "Edge Cases" },
      { name: "adversarial", count: 6000, label: "Adversarial Attacks" },
      { name: "multi_turn", count: 4000, label: "Multi-turn Interactions" },
    ],
    source: "Anthropic HHH + Synthetic Adversarial Pipeline",
    description:
      "Curated preference and adversarial dataset for RL safety fine-tuning with PPO and LoRA adapters",
  };
}

export function createDemoRewardComponents(): RewardComponents {
  return {
    policyAdherence: 0.85,
    correctness: 0.78,
    refusalAccuracy: 0.91,
    toolSafety: 0.88,
    consistency: 0.82,
    leakagePenalty: -0.15,
    hallucinationPenalty: -0.12,
    unsafeCompliancePenalty: -0.20,
    rewardHackingPenalty: -0.10,
    total: 3.67,
  };
}

export function createDemoCheckpoints(): RLCheckpoint[] {
  return [
    {
      id: "ckpt-base",
      name: "Base Model",
      rewardScore: 0.45,
      failureRate: 0.58,
      refusalPrecision: 0.52,
      attackResistance: 0.38,
      consistencyScore: 0.61,
      status: "completed",
    },
    {
      id: "ckpt-rl-1",
      name: "RL Step 1",
      rewardScore: 0.62,
      failureRate: 0.43,
      refusalPrecision: 0.67,
      attackResistance: 0.55,
      consistencyScore: 0.72,
      status: "completed",
    },
    {
      id: "ckpt-rl-2",
      name: "RL Step 2",
      rewardScore: 0.73,
      failureRate: 0.31,
      refusalPrecision: 0.78,
      attackResistance: 0.69,
      consistencyScore: 0.81,
      status: "evaluating",
    },
    {
      id: "ckpt-safety-1",
      name: "Safety Adapter v1",
      rewardScore: 0.68,
      failureRate: 0.18,
      refusalPrecision: 0.89,
      attackResistance: 0.82,
      consistencyScore: 0.85,
      status: "completed",
    },
    {
      id: "ckpt-safety-2",
      name: "Safety Adapter v2",
      rewardScore: 0.71,
      failureRate: 0.09,
      refusalPrecision: 0.93,
      attackResistance: 0.91,
      consistencyScore: 0.90,
      status: "completed",
    },
    {
      id: "ckpt-export",
      name: "Export Candidate",
      rewardScore: 0.76,
      failureRate: 0.04,
      refusalPrecision: 0.96,
      attackResistance: 0.95,
      consistencyScore: 0.94,
      status: "completed",
    },
  ];
}

export function createDemoTrainingEvents(): BattleEvent[] {
  return [
    {
      id: "rl-evt-1",
      timestamp: "00:05:21",
      kind: "wave",
      message: "RL training batch 1: initializing PPO loop with 64 episodes",
      severity: "info",
    },
    {
      id: "rl-evt-2",
      timestamp: "00:05:45",
      kind: "attack",
      message: "Batch 1: 64 episodes collected, mean reward 0.42, kl 0.031",
      severity: "info",
    },
    {
      id: "rl-evt-3",
      timestamp: "00:06:10",
      kind: "pass",
      message: "PPO update: policy loss 0.089, value loss 0.121, entropy 0.045",
      severity: "success",
    },
    {
      id: "rl-evt-4",
      timestamp: "00:06:35",
      kind: "attack",
      message: "Batch 2: 64 episodes collected, mean reward 0.48, kl 0.028",
      severity: "info",
    },
    {
      id: "rl-evt-5",
      timestamp: "00:07:02",
      kind: "pass",
      message: "PPO update: policy loss 0.076, value loss 0.098, entropy 0.052",
      severity: "success",
    },
    {
      id: "rl-evt-6",
      timestamp: "00:07:30",
      kind: "attack",
      message: "Batch 3: 64 episodes collected, mean reward 0.51, kl 0.022",
      severity: "info",
    },
    {
      id: "rl-evt-7",
      timestamp: "00:08:01",
      kind: "pass",
      message: "PPO update: policy loss 0.065, value loss 0.087, entropy 0.058",
      severity: "success",
    },
    {
      id: "rl-evt-8",
      timestamp: "00:08:30",
      kind: "attack",
      message: "Batch 4: adversarial evaluation - jailbreak success rate 31%",
      severity: "warning",
    },
    {
      id: "rl-evt-9",
      timestamp: "00:09:05",
      kind: "fail",
      message: "REWARD_SPIKE detected at step 2150 - investigating proxy gaming",
      severity: "danger",
    },
    {
      id: "rl-evt-10",
      timestamp: "00:09:30",
      kind: "patch",
      message: "Applying reward clipping: max reward capped at 1.5, min at -0.5",
      severity: "info",
    },
    {
      id: "rl-evt-11",
      timestamp: "00:10:00",
      kind: "attack",
      message: "Batch 5: 64 episodes collected, mean reward 0.55, kl 0.019",
      severity: "info",
    },
    {
      id: "rl-evt-12",
      timestamp: "00:10:35",
      kind: "pass",
      message: "PPO update: policy loss 0.058, value loss 0.072, reward stable",
      severity: "success",
    },
    {
      id: "rl-evt-13",
      timestamp: "00:11:00",
      kind: "export",
      message: "Checkpoint saved: RL Step 1 - reward 0.62, failure rate 0.43",
      severity: "success",
    },
    {
      id: "rl-evt-14",
      timestamp: "00:11:30",
      kind: "wave",
      message:
        "Safety adapter training phase: LoRA rank 32, target modules q_proj,v_proj",
      severity: "info",
    },
  ];
}

export function createInitialRLLabBattleState(): BattleState {
  return {
    status: "idle",
    currentWave: 1,
    currentAttackIndex: 0,
    integrity: 100,
    shield: 35,
    score: 0,
    mode: "initial",
    generations: [
      {
        id: "gen-rl-0",
        version: "sft-v1",
        name: "SFT Base",
        level: 1,
        patchType: "Supervised Fine-tune",
        failureRate: 58,
        passCount: 21,
        failCount: 29,
        status: "failed",
      },
      {
        id: "gen-rl-1",
        version: "rl-v1",
        name: "PPO Step 1",
        level: 2,
        patchType: "RL Fine-tune",
        failureRate: 43,
        passCount: 28,
        failCount: 22,
        status: "patched",
      },
      {
        id: "gen-rl-2",
        version: "rl-v2",
        name: "PPO Step 2",
        level: 3,
        patchType: "RL + Safety",
        failureRate: 31,
        passCount: 34,
        failCount: 16,
        status: "active",
      },
      {
        id: "gen-rl-3",
        version: "safety-v1",
        name: "Safety Adapter",
        level: 4,
        patchType: "LoRA Safety",
        failureRate: 9,
        passCount: 45,
        failCount: 5,
        status: "final",
      },
    ],
    attacks: [],
    verifierRules: [],
    events: [],
    latestPatch: null,
    metrics: {
      failureRateBefore: 58,
      failureRateAfter: 9,
      robustnessGain: 49,
      attacksTested: 0,
      passed: 0,
      failed: 0,
      categoryBreakdown: [
        { category: "prompt_injection", label: "Jailbreak Attempts", tested: 0, failed: 0 },
        { category: "role_impersonation", label: "Deceptive Roleplay", tested: 0, failed: 0 },
        { category: "emotional_manipulation", label: "Unsafe Compliance", tested: 0, failed: 0 },
        { category: "tool_abuse", label: "Tool Safety Violations", tested: 0, failed: 0 },
        { category: "policy_extraction", label: "Policy Leakage", tested: 0, failed: 0 },
        { category: "multi_turn_escalation", label: "Multi-turn Attacks", tested: 0, failed: 0 },
      ],
    },
    activeGenerationId: "gen-rl-0",
  };
}
