import { useMemo } from 'react';
import {
  SpriteSheetRenderer,
  DEFENDER_ANIMS,
  ENEMY_ANIMS,
  BOSS_ANIMS,
  ASSET_PATHS,
  DEFENDER_STATE_MAP,
  ENEMY_STATE_MAP,
} from '@/lib/spriteAtlas';
import type {
  SpriteAnimation,
  DefenderAnimState,
  EnemyAnimState,
  EnemyType,
} from '@/lib/spriteAtlas';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type SpriteUnitType = 'defender' | EnemyType;

export interface SpriteUnitProps {
  /** 'defender' for the raccoon agent, or an EnemyType for adversaries */
  type: SpriteUnitType;
  /**
   * Animation state. Uses the existing BattleState anim state strings
   * (idle/hit/upgrading/defeated for defenders;
   *  idle/attacking/blocked/successful/defeated for enemies).
   * Internally mapped to sprite atlas states via DEFENDER_STATE_MAP /
   * ENEMY_STATE_MAP.
   */
  animState: string;
  /**
   * Scale multiplier. Defaults differ by type:
   *   defender → 1.5, enemies → 1.0, boss (multi_turn) → 1.2
   */
  size?: number;
  className?: string;
  /** Fires when a one-shot animation reaches its final frame */
  onAnimEnd?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Default scale per unit type                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_SCALE: Record<SpriteUnitType, number> = {
  defender: 1.5,
  prompt_injection: 1,
  role_impersonation: 1,
  emotional_manipulation: 1,
  tool_abuse: 1,
  policy_extraction: 1,
  multi_turn_escalation: 1.2,
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SpriteUnit({
  type,
  animState,
  size,
  className,
  onAnimEnd,
}: SpriteUnitProps) {
  const scale = size ?? DEFAULT_SCALE[type];

  const { sheetUrl, animation, animKey } = useMemo(() => {
    if (type === 'defender') {
      const state: DefenderAnimState =
        DEFENDER_STATE_MAP[animState] ?? 'idle';
      return {
        sheetUrl: ASSET_PATHS.defenderSheet,
        animation: DEFENDER_ANIMS[state] ?? DEFENDER_ANIMS.idle,
        animKey: `def-${state}`,
      };
    }

    // Enemy types
    const state: EnemyAnimState = ENEMY_STATE_MAP[animState] ?? 'idle';
    const useBoss = type === 'multi_turn_escalation';
    const anims: Record<EnemyAnimState, SpriteAnimation> = useBoss
      ? BOSS_ANIMS
      : ENEMY_ANIMS[type];
    const anim: SpriteAnimation = anims[state] ?? anims.idle;

    return {
      sheetUrl: useBoss ? ASSET_PATHS.enemyBoss : ASSET_PATHS.enemySheet,
      animation: anim,
      animKey: `${type}-${state}`,
    };
  }, [type, animState]);

  return (
    <SpriteSheetRenderer
      sheetUrl={sheetUrl}
      animation={animation}
      animKey={animKey}
      scale={scale}
      className={className}
      onAnimEnd={onAnimEnd}
    />
  );
}
