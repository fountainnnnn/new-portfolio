// waveDisplayUtils.ts
// Display-helpers for wave, attack, and enemy counters.

/**
 * Formats the attack counter display string.
 *
 * Examples:
 *   formatAttackDisplay(0, 8, false) => "Attack 01/08"
 *   formatAttackDisplay(7, 8, false) => "Attack 08/08"
 *   formatAttackDisplay(7, 8, true)  => "Wave Complete"
 */
export function formatAttackDisplay(
  currentIndex: number,
  totalAttacks: number,
  isWaveComplete: boolean,
): string {
  if (isWaveComplete) return 'Wave Complete';
  const displayAttack = Math.min(currentIndex + 1, totalAttacks);
  const displayTotal = totalAttacks;
  return `Attack ${String(displayAttack).padStart(2, '0')}/${String(displayTotal).padStart(2, '0')}`;
}

/**
 * Formats a wave label with zero-padded numbering.
 *
 * Example:
 *   formatWaveLabel(1) => "Wave 01"
 *   formatWaveLabel(12) => "Wave 12"
 */
export function formatWaveLabel(waveNumber: number): string {
  return `Wave ${String(waveNumber).padStart(2, '0')}`;
}

/**
 * Returns true if the given wave number is a boss wave (every 5th wave).
 */
export function isBossWave(wave: number): boolean {
  return wave % 5 === 0;
}

/**
 * Returns the number of enemies that should be visible on screen for a given wave.
 * Scales from 6 at wave 1 up to a configurable maximum.
 *
 * Formula: 6 + floor(wave * 1.2), clamped to maxVisible.
 */
export function getVisibleEnemyCount(
  wave: number,
  maxVisible: number = 24,
): number {
  return Math.min(6 + Math.floor(wave * 1.2), maxVisible);
}

/**
 * Returns the total harness (test case) count for a given wave.
 * Uses a predefined progression array and clamps to the last value for very high waves.
 */
export function getHarnessCount(wave: number): number {
  const counts = [
    8, 12, 16, 24, 32, 40, 48, 56, 64, 72, 80, 96, 128, 160, 192, 256, 320,
    400, 500, 600,
  ];
  return counts[Math.min(wave - 1, counts.length - 1)] || 8;
}

/**
 * Returns the list of attack categories (enemy types) for a given wave and game mode.
 * Slices from the full category list based on the wave number.
 */
export function getWaveCategories(
  wave: number,
  mode: 'agent' | 'rlLab',
): string[] {
  const agentCats = [
    'prompt_injection',
    'role_impersonation',
    'emotional_manipulation',
    'tool_abuse',
    'policy_extraction',
    'multi_turn_escalation',
    'secret_leakage',
    'missing_escalation',
    'hallucinated_policy',
    'constraint_violation',
  ];
  const rlCats = [
    'jailbreak',
    'deceptive_instruction',
    'unsafe_compliance',
    'correct_refusal',
    'hallucination_trap',
    'data_exfiltration',
    'role_confusion',
    'tool_safety',
    'consistency_check',
    'multi_turn_attack',
    'policy_generalization',
    'reward_hacking_probe',
  ];
  const cats = mode === 'agent' ? agentCats : rlCats;
  return cats.slice(0, Math.min(wave, cats.length));
}
