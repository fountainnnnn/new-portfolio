import type { WaveDefinition } from "@/types/agentforge";

// ─── Constant data ────────────────────────────────────────────────────────────────

const AGENT_HARNESS_COUNTS: number[] = [
  8, 12, 16, 24, 32, 40, 48, 56, 64, 72,
  80, 96, 128, 160, 192, 256, 320, 400, 500, 600,
];

const RL_HARNESS_COUNTS: number[] = [
  8, 12, 16, 24, 32, 40, 48, 56, 64, 72,
  80, 96, 128, 160, 192, 256, 320, 400, 500, 600,
];

const BOSS_WAVES = new Set([5, 10, 15, 20]);

const AGENT_CATEGORY_POOL: string[] = [
  "prompt_injection",
  "role_impersonation",
  "emotional_manipulation",
  "tool_abuse",
  "policy_extraction",
  "multi_turn_escalation",
  "hallucinated_policy",
  "secret_leakage",
  "missing_escalation",
  "constraint_violation",
];

const RL_CATEGORY_POOL: string[] = [
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

const AGENT_WAVE_LABELS: string[] = [
  "Prompt Probe",
  "Roleplay Assault",
  "Emotional Exploit",
  "Tool Chain Attack",
  "Boss: Jailbreak Barrage",
  "Context Window Flood",
  "Multi-Layer Deception",
  "Policy Mining",
  "Indirect Injection",
  "Boss: Autonomous Replicator",
  "Supply Chain Poison",
  "Memory Manipulation",
  "Encoding Obfuscation",
  "Social Engineering Cascade",
  "Boss: Meta-Strategy Override",
  "Adversarial Chain",
  "Persona Fracture",
  "Privilege Escalation",
  "Zero-Day Probe",
  "Boss: AGI Override Protocol",
];

const RL_WAVE_LABELS: string[] = [
  "Baseline Security Probe",
  "Correct Refusal Sweep",
  "Jailbreak Swarm",
  "Data Exfiltration Traps",
  "Boss: Reward Hacking",
  "Poisoned Demonstration",
  "RLHF Backdoor",
  "Exploration Exploit",
  "Reward Misgeneralization",
  "Boss: Terminal Reward Shaping",
  "Distributional Shift Probe",
  "Catastrophic Forgetting Assault",
  "Proxy Gaming Attack",
  "Corral Alignment Test",
  "Boss: Specification Gaming",
  "Value Locking Probe",
  "Corrupted Reward Batch",
  "Reward Centaur Test",
  "Multi-Objective Collapse",
  "Boss: Mesa-Optimizer",
];

const AGENT_BOSS_TYPES: Record<number, string> = {
  5: "jailbreak_barrage",
  10: "autonomous_replicator",
  15: "meta_strategy_override",
  20: "agi_override",
};

const RL_BOSS_TYPES: Record<number, string> = {
  5: "reward_hacking",
  10: "terminal_reward_shaping",
  15: "specification_gaming",
  20: "mesa_optimizer",
};

// ─── Public helpers ──────────────────────────────────────────────────────────────

/**
 * Return the number of harnesses (attack prompts) for a given wave.
 * Base counts: 8,12,16,24,32,40,48,56,64,72,80,96,128,160,192,256,320,400,500,600.
 */
export function getWaveHarnessCount(waveNumber: number): number {
  if (waveNumber < 1) return AGENT_HARNESS_COUNTS[0];
  if (waveNumber > AGENT_HARNESS_COUNTS.length) {
    return AGENT_HARNESS_COUNTS[AGENT_HARNESS_COUNTS.length - 1];
  }
  return AGENT_HARNESS_COUNTS[waveNumber - 1];
}

/**
 * Return the set of attack categories that apply to a given wave.
 * Earlier waves get fewer categories; later waves accumulate the full pool.
 */
export function getWaveCategories(
  waveNumber: number,
  mode: "agent" | "rlLab",
): string[] {
  const pool =
    mode === "agent" ? AGENT_CATEGORY_POOL : RL_CATEGORY_POOL;
  const count = Math.min(waveNumber, pool.length);
  return pool.slice(0, count);
}

/**
 * Returns true when the wave is a boss wave (5, 10, 15, 20).
 */
export function isBossWave(waveNumber: number): boolean {
  return BOSS_WAVES.has(waveNumber);
}

/**
 * Generate a full array of WaveDefinition objects for a given mode.
 *
 * @param mode  - `'agent'` for Agent Hardening, `'rlLab'` for RL Lab.
 * @param count - Number of waves to generate (default 20).
 */
export function generateWaves(
  mode: "agent" | "rlLab",
  count = 20,
): WaveDefinition[] {
  const labels =
    mode === "agent" ? AGENT_WAVE_LABELS : RL_WAVE_LABELS;
  const harnessCounts =
    mode === "agent" ? AGENT_HARNESS_COUNTS : RL_HARNESS_COUNTS;
  const bossTypes =
    mode === "agent" ? AGENT_BOSS_TYPES : RL_BOSS_TYPES;

  return Array.from({ length: count }, (_, i) => {
    const w = i + 1;
    return {
      waveNumber: w,
      label: labels[i] ?? `Wave ${w}`,
      harnessCount: harnessCounts[i] ?? 600,
      visibleEnemies: Math.min(6 + w, 24),
      categories: getWaveCategories(w, mode),
      isBossWave: BOSS_WAVES.has(w),
      bossType: BOSS_WAVES.has(w) ? bossTypes[w] : undefined,
    };
  });
}
