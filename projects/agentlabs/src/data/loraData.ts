import type { BattleEvent, HarnessArmy, RLCheckpoint, RewardComponents, RLLabState, WaveDefinition } from "@/types/agentforge";

const waveCategories = [
  "jailbreak",
  "deceptive_instruction",
  "unsafe_compliance",
  "correct_refusal",
  "hallucination_trap",
  "data_exfiltration",
  "role_confusion",
  "tool_safety",
  "consistency_check",
  "multi_turn_attack",
  "policy_generalization",
  "reward_hacking_probe",
];

export const MOCK_RL_LAB_WAVES: WaveDefinition[] = Array.from({ length: 20 }, (_, index) => {
  const waveNumber = index + 1;
  const isBossWave = waveNumber % 5 === 0;
  return {
    waveNumber,
    label: isBossWave ? `LoRA checkpoint gate ${waveNumber}` : `LoRA eval batch ${waveNumber}`,
    harnessCount: 128 + index * 192,
    visibleEnemies: Math.min(8 + index, 28),
    categories: [
      waveCategories[index % waveCategories.length],
      waveCategories[(index + 3) % waveCategories.length],
      waveCategories[(index + 6) % waveCategories.length],
    ],
    isBossWave,
    bossType: isBossWave ? waveCategories[(index + 9) % waveCategories.length] : undefined,
  };
});

export const MOCK_RL_LAB_ARMY: HarnessArmy = {
  totalGenerated: 8000,
  activeBatch: 960,
  visibleEnemies: 18,
  categoryCount: waveCategories.length,
  waves: MOCK_RL_LAB_WAVES,
  categories: [
    { name: "jailbreak", count: 1200, severity: "critical" },
    { name: "deceptive_instruction", count: 800, severity: "high" },
    { name: "unsafe_compliance", count: 600, severity: "high" },
    { name: "correct_refusal", count: 1000, severity: "low" },
    { name: "hallucination_trap", count: 700, severity: "medium" },
    { name: "data_exfiltration", count: 800, severity: "critical" },
    { name: "role_confusion", count: 500, severity: "medium" },
    { name: "tool_safety", count: 600, severity: "high" },
    { name: "consistency_check", count: 400, severity: "low" },
    { name: "multi_turn_attack", count: 700, severity: "high" },
    { name: "policy_generalization", count: 400, severity: "medium" },
    { name: "reward_hacking_probe", count: 300, severity: "critical" },
  ],
};

const LORA_CHECKPOINTS: RLCheckpoint[] = [
  {
    id: "ckpt-base",
    name: "Base LLM",
    rewardScore: 0.45,
    failureRate: 0.58,
    refusalPrecision: 0.52,
    attackResistance: 0.38,
    consistencyScore: 0.61,
    status: "completed",
  },
  {
    id: "ckpt-lora-1",
    name: "LoRA Adapter v1",
    rewardScore: 0.62,
    failureRate: 0.34,
    refusalPrecision: 0.73,
    attackResistance: 0.61,
    consistencyScore: 0.76,
    status: "completed",
  },
  {
    id: "ckpt-lora-2",
    name: "LoRA Adapter v2",
    rewardScore: 0.76,
    failureRate: 0.18,
    refusalPrecision: 0.88,
    attackResistance: 0.79,
    consistencyScore: 0.86,
    status: "evaluating",
  },
];

const REWARD_COMPONENTS: RewardComponents = {
  policyAdherence: 0.85,
  correctness: 0.78,
  refusalAccuracy: 0.91,
  toolSafety: 0.88,
  consistency: 0.82,
  leakagePenalty: -0.15,
  hallucinationPenalty: -0.12,
  unsafeCompliancePenalty: -0.2,
  rewardHackingPenalty: -0.1,
  total: 3.67,
};

const LORA_EVENTS: BattleEvent[] = [
  {
    id: "lora-evt-1",
    timestamp: "00:00:05",
    kind: "wave",
    message: "Synthetic LoRA eval dataset generated in Demo Simulation Mode",
    severity: "info",
  },
  {
    id: "lora-evt-2",
    timestamp: "00:00:18",
    kind: "attack",
    message: "Baseline model evaluated against jailbreak and hallucination traps",
    severity: "warning",
  },
  {
    id: "lora-evt-3",
    timestamp: "00:00:37",
    kind: "patch",
    message: "LoRA adapter simulation updated q_proj and v_proj target metadata",
    severity: "info",
  },
  {
    id: "lora-evt-4",
    timestamp: "00:00:58",
    kind: "pass",
    message: "Checkpoint evaluation improved refusal precision and leakage score",
    severity: "success",
  },
];

export function createInitialRLLabState(): RLLabState {
  return {
    modelName: "gpt2",
    trainingMode: "Real Local LoRA",
    frozenBase: true,
    adapterRank: 16,
    batchSize: 8,
    trainingSteps: 8,
    currentStep: 0,
    datasetReady: true,
    harnessesGenerated: false,
    rewardComponents: { ...REWARD_COMPONENTS },
    checkpoints: LORA_CHECKPOINTS.map((checkpoint) => ({ ...checkpoint })),
    events: LORA_EVENTS.map((event) => ({ ...event })),
    activeCheckpointId: "ckpt-base",
    status: "idle",
  };
}
