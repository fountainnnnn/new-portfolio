// assetValidation.ts
// Validates that all expected agent forge assets are reachable via the loader.
// Reports missing assets and fallback warnings.

import {
  getHeroFrames,
  getEnemyFrames,
  getEffectFrames,
  getArenaBackground,
  HERO_STATES,
  ENEMY_TYPES,
  ENEMY_STATES,
  EFFECT_TYPES,
} from './agentforgeAssets';

export interface ValidationResult {
  passed: boolean;
  missingAssets: string[];
  warnings: string[];
}

/**
 * Iterates over all known hero states, enemy types, and effect types,
 * checking that the asset loader returns non-empty frame arrays.
 *
 * Returns a summary with:
 *  - `passed`: true when no assets are strictly missing
 *  - `missingAssets`: paths that have no frames at all (critical)
 *  - `warnings`: paths that fell back to idle or have no frames (non-critical)
 */
export function validateAgentForgeAssets(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Arena background
  if (!getArenaBackground()) {
    missing.push('arena background');
  }

  // Hero states -- idle must have frames
  for (const state of HERO_STATES) {
    const frames = getHeroFrames(state);
    if (frames.length === 0) {
      if (state === 'idle') {
        missing.push(`hero/${state}`);
      } else {
        warnings.push(`hero/${state} - falling back to idle`);
      }
    }
  }

  // Enemy types -- each must have idle and attack
  for (const type of ENEMY_TYPES) {
    const idleFrames = getEnemyFrames(type, 'idle');
    const attackFrames = getEnemyFrames(type, 'attack');
    if (idleFrames.length === 0) {
      missing.push(`enemies/${type}/idle`);
    }
    if (attackFrames.length === 0) {
      missing.push(`enemies/${type}/attack`);
    }
    for (const state of ENEMY_STATES) {
      if (getEnemyFrames(type, state).length === 0) {
        warnings.push(`enemies/${type}/${state} - falling back to idle`);
      }
    }
  }

  // Effect types -- missing effects are non-critical warnings
  for (const effect of EFFECT_TYPES) {
    if (getEffectFrames(effect).length === 0) {
      warnings.push(`effects/${effect} - missing, will use fallback`);
    }
  }

  return {
    passed: missing.length === 0,
    missingAssets: missing,
    warnings,
  };
}
