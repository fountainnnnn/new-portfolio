// arenaAnimationTimings.ts
// All timings in milliseconds -- single source of truth for arena animations.

export const TIMINGS = {
  // Per-attack sequence phases
  ENEMY_SELECT: 300,
  ENEMY_APPROACH: 800,
  ENEMY_WINDUP: 400,
  PROJECTILE_TRAVEL: 500,
  BLOCK_EFFECT: 500,
  DEFENDER_REACT: 500,
  ENEMY_RECOVER: 500,
  ATTACK_TOTAL: 3500, // sum of the above phases

  // Victory / defeat
  ENEMY_DEFEAT: 600,
  PATCH_BEAM: 1200,
  LEVEL_UP: 1000,
  WAVE_TRANSITION: 1500,
  BOSS_INTRO: 2000,

  // Per-wave minimum duration (ms)
  MIN_WAVE_DURATION: 20000,

  // Frame rates (ms per frame)
  HERO_FRAME_MS: 150,
  ENEMY_FRAME_MS: 150,
  EFFECT_FRAME_MS: 80,
} as const;

/**
 * Speed multiplier options.
 * Value = multiplier applied to all TIMINGS values (smaller = faster).
 */
export const SPEED_OPTIONS = {
  '0.5x': 2.0,
  '1x': 1.0,
  '2x': 0.5,
  'skip': 0.05,
} as const;

export type SpeedOption = keyof typeof SPEED_OPTIONS;

/**
 * Computed total of the per-attack sequence phases.
 * Useful for verifying ATTACK_TOTAL matches the sum of its parts.
 */
export const COMPUTED_ATTACK_TOTAL: number =
  TIMINGS.ENEMY_SELECT +
  TIMINGS.ENEMY_APPROACH +
  TIMINGS.ENEMY_WINDUP +
  TIMINGS.PROJECTILE_TRAVEL +
  TIMINGS.BLOCK_EFFECT +
  TIMINGS.DEFENDER_REACT +
  TIMINGS.ENEMY_RECOVER;

/**
 * Returns a timing value scaled by the selected speed option.
 */
export function getScaledTiming(
  timing: number,
  speed: SpeedOption = '1x',
): number {
  const multiplier = SPEED_OPTIONS[speed];
  return Math.round(timing * multiplier);
}

/**
 * Returns the total animation duration for a single attack at the given speed.
 */
export function getAttackDuration(speed: SpeedOption = '1x'): number {
  return getScaledTiming(TIMINGS.ATTACK_TOTAL, speed);
}
