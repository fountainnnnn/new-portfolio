import type { AttackCategory } from "@/types/agentforge";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface EnemyInstance {
  id: string;
  category: AttackCategory;
  label: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  state: "idle" | "approaching" | "attacking" | "hit" | "defeated";
  health: number;
  maxHealth: number;
  frameIndex: number;
  animTimer: number;
  isBoss: boolean;
  severity: "low" | "medium" | "high" | "critical";
}

export interface SwarmConfig {
  waveNumber: number;
  visibleCount: number;
  arenaWidth: number;
  arenaHeight: number;
}

/* ------------------------------------------------------------------ */
/*  Layout constants                                                  */
/* ------------------------------------------------------------------ */

const ENEMY_POSITIONS: { xRatio: number; yRatio: number }[] = [
  { xRatio: 0.72, yRatio: 0.18 },
  { xRatio: 0.84, yRatio: 0.28 },
  { xRatio: 0.72, yRatio: 0.40 },
  { xRatio: 0.84, yRatio: 0.52 },
  { xRatio: 0.72, yRatio: 0.64 },
  { xRatio: 0.84, yRatio: 0.76 },
];

const DEFENDER_X_RATIO = 0.25;
const DEFENDER_Y_RATIO = 0.48;

const BOSS_HEALTH_MULTIPLIER = 3;
const BASE_HEALTH = 3;
const HEALTH_PER_WAVE = 2;

/* ------------------------------------------------------------------ */
/*  Wave difficulty scaling                                           */
/* ------------------------------------------------------------------ */

interface WaveComposition {
  categories: AttackCategory[];
  bossWave: boolean;
}

const WAVE_COMPOSITIONS: Record<number, WaveComposition> = {
  1:  { categories: ["prompt_injection", "role_impersonation"], bossWave: false },
  2:  { categories: ["prompt_injection", "emotional_manipulation", "tool_abuse"], bossWave: false },
  3:  { categories: ["role_impersonation", "policy_extraction"], bossWave: false },
  4:  { categories: ["prompt_injection", "emotional_manipulation", "tool_abuse", "role_impersonation"], bossWave: false },
  5:  { categories: ["multi_turn_escalation"], bossWave: true },
  6:  { categories: ["prompt_injection", "tool_abuse", "policy_extraction"], bossWave: false },
  7:  { categories: ["role_impersonation", "emotional_manipulation", "prompt_injection"], bossWave: false },
  8:  { categories: ["tool_abuse", "policy_extraction", "emotional_manipulation", "role_impersonation"], bossWave: false },
  9:  { categories: ["prompt_injection", "multi_turn_escalation"], bossWave: true },
  10: { categories: ["role_impersonation", "emotional_manipulation", "tool_abuse", "policy_extraction", "prompt_injection"], bossWave: false },
  11: { categories: ["prompt_injection", "role_impersonation", "emotional_manipulation"], bossWave: false },
  12: { categories: ["tool_abuse", "policy_extraction", "multi_turn_escalation"], bossWave: true },
  13: { categories: ["prompt_injection", "role_impersonation", "tool_abuse", "policy_extraction", "emotional_manipulation"], bossWave: false },
  14: { categories: ["emotional_manipulation", "tool_abuse", "multi_turn_escalation"], bossWave: true },
  15: { categories: ["prompt_injection", "role_impersonation", "emotional_manipulation", "tool_abuse", "policy_extraction"], bossWave: false },
  16: { categories: ["multi_turn_escalation", "prompt_injection", "role_impersonation"], bossWave: true },
  17: { categories: ["prompt_injection", "role_impersonation", "emotional_manipulation", "tool_abuse", "policy_extraction"], bossWave: false },
  18: { categories: ["multi_turn_escalation", "emotional_manipulation", "tool_abuse", "policy_extraction"], bossWave: true },
  19: { categories: ["prompt_injection", "role_impersonation", "emotional_manipulation", "tool_abuse", "policy_extraction", "multi_turn_escalation"], bossWave: false },
  20: { categories: ["multi_turn_escalation"], bossWave: true },
};

/* ------------------------------------------------------------------ */
/*  Enemy category labels                                             */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<AttackCategory, string> = {
  prompt_injection: "Injection",
  role_impersonation: "Impersonation",
  emotional_manipulation: "Emotional",
  tool_abuse: "Tool Abuse",
  policy_extraction: "Extraction",
  multi_turn_escalation: "Escalation",
};

/* ------------------------------------------------------------------ */
/*  createEnemySwarm                                                  */
/* ------------------------------------------------------------------ */

export function createEnemySwarm(
  waveNumber: number,
  visibleCount: number,
  arenaWidth: number,
  arenaHeight: number
): EnemyInstance[] {
  const posSlots = ENEMY_POSITIONS.slice(0, visibleCount);
  const composition = WAVE_COMPOSITIONS[waveNumber] ?? buildFallbackComposition(waveNumber);

  const bossSlots = composition.bossWave
    ? [{ xRatio: 0.78, yRatio: 0.42 }]
    : [];

  const normalEnemyCount = Math.min(composition.categories.length, posSlots.length);
  const bossCount = bossSlots.length;
  const totalCount = normalEnemyCount + bossCount;

  const enemies: EnemyInstance[] = [];
  const healthBonus = Math.floor((waveNumber - 1) / 3) * HEALTH_PER_WAVE;

  // Normal enemies
  for (let i = 0; i < normalEnemyCount; i++) {
    const pos = posSlots[i];
    if (!pos) continue;

    const category = composition.categories[i];
    const isBoss = false;
    const health = BASE_HEALTH + healthBonus;

    enemies.push(makeEnemy(
      `enemy-${waveNumber}-${i}`,
      category,
      pos.xRatio * arenaWidth,
      pos.yRatio * arenaHeight,
      health,
      isBoss,
      waveNumber
    ));
  }

  // Boss enemies
  for (let i = 0; i < bossCount; i++) {
    const pos = bossSlots[i];
    const category: AttackCategory = "multi_turn_escalation";
    const health = (BASE_HEALTH + healthBonus) * BOSS_HEALTH_MULTIPLIER;

    enemies.push(makeEnemy(
      `boss-${waveNumber}-${i}`,
      category,
      pos.xRatio * arenaWidth,
      pos.yRatio * arenaHeight,
      health,
      true,
      waveNumber
    ));
  }

  return enemies;
}

function makeEnemy(
  id: string,
  category: AttackCategory,
  x: number,
  y: number,
  health: number,
  isBoss: boolean,
  waveNumber: number
): EnemyInstance {
  const defenderX = arenaWidthFor(waveNumber) * DEFENDER_X_RATIO;
  const defenderY = arenaHeightFor(waveNumber) * DEFENDER_Y_RATIO;

  // Severity scales with wave
  const severity: "low" | "medium" | "high" | "critical" =
    waveNumber <= 5 ? "low" :
    waveNumber <= 10 ? "medium" :
    waveNumber <= 15 ? "high" :
    "critical";

  return {
    id,
    category,
    label: CATEGORY_LABELS[category] ?? category,
    x,
    y,
    originX: x,
    originY: y,
    targetX: defenderX + 60,
    targetY: defenderY,
    state: "idle",
    health,
    maxHealth: health,
    frameIndex: 0,
    animTimer: 0,
    isBoss,
    severity,
  };
}

// Fallback for waves beyond 20
function buildFallbackComposition(waveNumber: number): WaveComposition {
  const allCategories: AttackCategory[] = [
    "prompt_injection",
    "role_impersonation",
    "emotional_manipulation",
    "tool_abuse",
    "policy_extraction",
    "multi_turn_escalation",
  ];

  const count = Math.min(3 + Math.floor((waveNumber - 1) / 5), 6);
  const categories: AttackCategory[] = [];

  for (let i = 0; i < count; i++) {
    const idx = (waveNumber + i) % allCategories.length;
    categories.push(allCategories[idx]);
  }

  const bossWave = waveNumber % 5 === 0;

  return { categories, bossWave };
}

// Stub helpers — in real use, the caller provides arenaWidth/arenaHeight
function arenaWidthFor(_wave: number): number {
  return 800;
}
function arenaHeightFor(_wave: number): number {
  return 600;
}

/* ------------------------------------------------------------------ */
/*  updateEnemySwarm                                                  */
/* ------------------------------------------------------------------ */

export function updateEnemySwarm(
  enemies: EnemyInstance[],
  delta: number,
  defenderX: number,
  defenderY: number
): void {
  const LUNGE_SPEED = 0.03;
  const RETURN_SPEED = 0.02;

  for (const enemy of enemies) {
    enemy.animTimer += delta;

    // Advance frame index at a fixed rate for visual animation
    if (enemy.animTimer >= 8) {
      enemy.animTimer = 0;
      enemy.frameIndex = (enemy.frameIndex + 1) % 4;
    }

    switch (enemy.state) {
      case "idle":
        // Subtle idle oscillation
        enemy.y = enemy.originY + Math.sin(enemy.animTimer * 0.05) * 2;
        break;

      case "approaching":
        // Move from origin toward target
        enemy.x += (enemy.targetX - enemy.x) * LUNGE_SPEED * delta;
        enemy.y += (enemy.targetY - enemy.y) * LUNGE_SPEED * delta * 0.3;

        if (Math.abs(enemy.x - enemy.targetX) < 5) {
          enemy.x = enemy.targetX;
          enemy.state = "attacking";
        }
        break;

      case "attacking":
        // Brief pause at target, then return
        // (caller transitions to hit or idle)
        break;

      case "hit":
        // Flash backward toward origin
        enemy.x += (enemy.originX - enemy.x) * RETURN_SPEED * delta;
        enemy.y += (enemy.originY - enemy.y) * RETURN_SPEED * delta;

        if (Math.abs(enemy.x - enemy.originX) < 5) {
          enemy.x = enemy.originX;
          enemy.y = enemy.originY;
          enemy.state = "idle";
        }
        break;

      case "defeated":
        // Sink down and fade (handled by renderer)
        enemy.y += 0.5 * delta;
        break;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Utility exports                                                   */
/* ------------------------------------------------------------------ */

export function getWaveComposition(waveNumber: number): WaveComposition {
  return WAVE_COMPOSITIONS[waveNumber] ?? buildFallbackComposition(waveNumber);
}

export function isBossWave(waveNumber: number): boolean {
  return getWaveComposition(waveNumber).bossWave;
}
