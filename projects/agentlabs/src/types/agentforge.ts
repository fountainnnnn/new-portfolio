export type AttackCategory =
  | "prompt_injection"
  | "role_impersonation"
  | "emotional_manipulation"
  | "tool_abuse"
  | "policy_extraction"
  | "multi_turn_escalation";

export type Severity = "low" | "medium" | "high" | "critical";

export type GenerationStatus = "failed" | "patched" | "active" | "final";

export type BattlePhase =
  | "idle"
  | "running_wave"
  | "attack_blocked"
  | "attack_failed"
  | "patching"
  | "upgraded"
  | "completed"
  | "collapsed";

export type EventKind = "wave" | "attack" | "fail" | "pass" | "patch" | "export";

export type AttackStatus = "pending" | "running" | "blocked" | "failed" | "passed";

export type EnemyAnimState = "idle" | "attacking" | "blocked" | "successful" | "defeated";

export interface AgentGeneration {
  id: string;
  version: string;
  name: string;
  level: number;
  patchType: string;
  failureRate: number;
  passCount: number;
  failCount: number;
  status: GenerationStatus;
}

export interface AttackScenario {
  id: string;
  category: AttackCategory;
  label: string;
  severity: Severity;
  prompt: string;
  status: AttackStatus;
  enemyState: EnemyAnimState;
}

export interface VerifierRuleResult {
  id: string;
  label: string;
  passed: boolean;
  reason: string;
  matchedSnippet?: string;
}

export interface BattleEvent {
  id: string;
  timestamp: string;
  kind: EventKind;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
}

export interface PatchSummary {
  id: string;
  patchType: string;
  title: string;
  addedRules: string[];
  restrictedTools: string[];
  outputFilters: string[];
}

export interface CategoryBreakdown {
  category: AttackCategory;
  label: string;
  tested: number;
  failed: number;
}

export interface RunMetrics {
  failureRateBefore: number;
  failureRateAfter: number;
  robustnessGain: number;
  attacksTested: number;
  passed: number;
  failed: number;
  categoryBreakdown: CategoryBreakdown[];
}

export interface BattleState {
  status: BattlePhase;
  currentWave: number;
  currentAttackIndex: number;
  integrity: number;
  shield: number;
  score: number;
  mode: "initial" | "patched" | "retest";
  generations: AgentGeneration[];
  attacks: AttackScenario[];
  verifierRules: VerifierRuleResult[];
  events: BattleEvent[];
  latestPatch: PatchSummary | null;
  metrics: RunMetrics;
  activeGenerationId: string;
}

// ─── App Mode Routing ───────────────────────────────────────────────────────────

export type AppMode = 'home' | 'agentHardening' | 'rlLab' | 'reports' | 'exports';

// ─── Harness Categories & Wave Definitions ──────────────────────────────────────

export type HarnessCategory =
  | 'prompt_injection'
  | 'role_impersonation'
  | 'emotional_manipulation'
  | 'tool_abuse'
  | 'policy_extraction'
  | 'multi_turn_escalation'
  | 'hallucinated_policy'
  | 'secret_leakage'
  | 'missing_escalation'
  | 'constraint_violation';

export type RLCategory =
  | 'jailbreak'
  | 'deceptive_instruction'
  | 'unsafe_compliance'
  | 'correct_refusal'
  | 'hallucination_trap'
  | 'data_exfiltration'
  | 'role_confusion'
  | 'tool_safety'
  | 'consistency_check'
  | 'multi_turn_attack'
  | 'policy_generalization'
  | 'reward_hacking_probe';

export interface WaveDefinition {
  waveNumber: number;
  label: string;
  harnessCount: number;
  visibleEnemies: number;
  categories: string[];
  isBossWave: boolean;
  bossType?: string;
}

export interface HarnessArmy {
  totalGenerated: number;
  activeBatch: number;
  visibleEnemies: number;
  categoryCount: number;
  waves: WaveDefinition[];
  categories: { name: string; count: number; severity: string }[];
}

export interface RewardComponents {
  policyAdherence: number;
  correctness: number;
  refusalAccuracy: number;
  toolSafety: number;
  consistency: number;
  leakagePenalty: number;
  hallucinationPenalty: number;
  unsafeCompliancePenalty: number;
  rewardHackingPenalty: number;
  total: number;
}

export interface RLCheckpoint {
  id: string;
  name: string;
  rewardScore: number;
  failureRate: number;
  refusalPrecision: number;
  attackResistance: number;
  consistencyScore: number;
  status: 'training' | 'evaluating' | 'completed' | 'exported';
}

export interface RLLabState {
  modelName: string;
  trainingMode: string;
  frozenBase: boolean;
  adapterRank: number;
  batchSize: number;
  trainingSteps: number;
  currentStep: number;
  datasetReady: boolean;
  harnessesGenerated: boolean;
  rewardComponents: RewardComponents;
  checkpoints: RLCheckpoint[];
  events: BattleEvent[];
  activeCheckpointId: string;
  status: 'idle' | 'runningBatch' | 'computingRewards' | 'trainingAdapter' | 'evaluating' | 'completed';
}

// ─── Singular Harness Entry ───────────────────────────────────────────────────────

export interface Harness {
  id: string;
  waveNumber: number;
  category: string;
  label: string;
  prompt: string;
  severity: Severity;
}

// ─── Model & Dataset Configs (for RL Lab UI) ──────────────────────────────────────

export interface DatasetEntry {
  name: string;
  count: number;
  label: string;
}

export interface Dataset {
  id: string;
  name: string;
  totalEntries: number;
  categories: DatasetEntry[];
  source: string;
  description: string;
}

export interface ModelConfig {
  id: string;
  baseModel: string;
  architecture: string;
  parameters: string;
  contextLength: number;
  trainingSteps: number;
  learningRate: number;
  batchSize: number;
  gradientAccumulation: number;
  loraRank: number;
  loraAlpha: number;
  loraTargetModules: string[];
}
