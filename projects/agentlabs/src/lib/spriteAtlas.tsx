import React, { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteAnimation {
  frames: SpriteFrame[];
  frameTime: number;
  loop: boolean;
}

export type DefenderAnimState =
  | 'idle'
  | 'run'
  | 'attack'
  | 'defend'
  | 'hit'
  | 'patch'
  | 'broken'
  | 'victory';

export type EnemyAnimState =
  | 'idle'
  | 'move'
  | 'attack'
  | 'hit'
  | 'collapse';

export type EnemyType =
  | 'prompt_injection'
  | 'role_impersonation'
  | 'emotional_manipulation'
  | 'tool_abuse'
  | 'policy_extraction'
  | 'multi_turn_escalation';

/* ------------------------------------------------------------------ */
/*  Frame coordinate helpers                                          */
/* ------------------------------------------------------------------ */
/*  Estimates based on standard 64x64 grid with 1-2px gutter.         */
/*  Adjust FRAME_W / FRAME_H / PAD once final assets are exported.    */

const FRAME_W = 64;
const FRAME_H = 64;
const PAD = 1;

function frame(
  col: number,
  row: number,
  w = FRAME_W,
  h = FRAME_H,
  pad = PAD,
): SpriteFrame {
  return {
    x: col * (w + pad),
    y: row * (h + pad),
    w,
    h,
  };
}

/* ------------------------------------------------------------------ */
/*  Defender animations (raccoon_main_anim_sheet.png)                 */
/*  Grid: 4 cols x 8 rows, 64x64 each, 1px padding                   */
/*  Row order: idle, run, attack, defend, hit, patch, broken, victory*/
/* ------------------------------------------------------------------ */

export const DEFENDER_ANIMS: Record<DefenderAnimState, SpriteAnimation> = {
  idle: {
    frames: [frame(0, 0), frame(1, 0), frame(2, 0), frame(3, 0)],
    frameTime: 200,
    loop: true,
  },
  run: {
    frames: [frame(0, 1), frame(1, 1), frame(2, 1), frame(3, 1)],
    frameTime: 120,
    loop: true,
  },
  attack: {
    frames: [frame(0, 2), frame(1, 2), frame(2, 2), frame(3, 2)],
    frameTime: 100,
    loop: false,
  },
  defend: {
    frames: [frame(0, 3), frame(1, 3)],
    frameTime: 250,
    loop: true,
  },
  hit: {
    frames: [frame(0, 4), frame(1, 4)],
    frameTime: 150,
    loop: false,
  },
  patch: {
    frames: [frame(0, 5), frame(1, 5), frame(2, 5)],
    frameTime: 300,
    loop: false,
  },
  broken: {
    frames: [frame(0, 6)],
    frameTime: 500,
    loop: false,
  },
  victory: {
    frames: [frame(0, 7), frame(1, 7)],
    frameTime: 400,
    loop: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Enemy animations (enemy_action_sheet.png)                         */
/*  Grid: 7 cols x 6 rows, 56x56 each, 1px padding                   */
/*  Row -> type mapping:                                              */
/*    0 = prompt_injection  (fox)                                     */
/*    1 = role_impersonation (cat)                                    */
/*    2 = emotional_manipulation (rabbit)                              */
/*    3 = tool_abuse (badger)                                         */
/*    4 = policy_extraction (owl)                                     */
/*    5 = multi_turn_escalation (wolf)                                */
/*  Col -> state: 0=idle, 1-2=move, 3-4=attack, 5=hit, 6=collapse   */
/* ------------------------------------------------------------------ */

function enemyFrames(row: number): Record<EnemyAnimState, SpriteAnimation> {
  return {
    idle: {
      frames: [frame(0, row, 56, 56)],
      frameTime: 400,
      loop: true,
    },
    move: {
      frames: [frame(1, row, 56, 56), frame(2, row, 56, 56)],
      frameTime: 180,
      loop: true,
    },
    attack: {
      frames: [frame(3, row, 56, 56), frame(4, row, 56, 56)],
      frameTime: 120,
      loop: false,
    },
    hit: {
      frames: [frame(5, row, 56, 56)],
      frameTime: 200,
      loop: false,
    },
    collapse: {
      frames: [frame(6, row, 56, 56)],
      frameTime: 300,
      loop: false,
    },
  };
}

export const ENEMY_ANIMS: Record<
  EnemyType,
  Record<EnemyAnimState, SpriteAnimation>
> = {
  prompt_injection: enemyFrames(0),
  role_impersonation: enemyFrames(1),
  emotional_manipulation: enemyFrames(2),
  tool_abuse: enemyFrames(3),
  policy_extraction: enemyFrames(4),
  multi_turn_escalation: enemyFrames(5),
};

/* ------------------------------------------------------------------ */
/*  Boss animations (enemy_boss_sheet.png)                            */
/*  Grid: 7 cols x 1 row (per type), 72x72 frames                    */
/*  Used as an alternate sheet for multi_turn_escalation / elite      */
/* ------------------------------------------------------------------ */

export const BOSS_ANIMS: Record<EnemyAnimState, SpriteAnimation> = {
  idle: {
    frames: [frame(0, 0, 72, 72)],
    frameTime: 400,
    loop: true,
  },
  move: {
    frames: [frame(1, 0, 72, 72), frame(2, 0, 72, 72)],
    frameTime: 180,
    loop: true,
  },
  attack: {
    frames: [frame(3, 0, 72, 72), frame(4, 0, 72, 72)],
    frameTime: 120,
    loop: false,
  },
  hit: {
    frames: [frame(5, 0, 72, 72)],
    frameTime: 200,
    loop: false,
  },
  collapse: {
    frames: [frame(6, 0, 72, 72)],
    frameTime: 300,
    loop: false,
  },
};

/* ------------------------------------------------------------------ */
/*  Asset path map                                                    */
/*  Public URL paths — assets live under /public/assets/agentforge/   */
/* ------------------------------------------------------------------ */

export const ASSET_PATHS = {
  defenderSheet: '/assets/agentforge/sprites/hero/raccoon_main_anim_sheet.png',
  defenderAlt: '/assets/agentforge/sprites/hero/raccoon_alt_sheet.png',
  enemySheet: '/assets/agentforge/sprites/enemies/enemy_action_sheet.png',
  enemyBoss: '/assets/agentforge/sprites/enemies/enemy_boss_sheet.png',
  effectsSheet: '/assets/agentforge/sprites/effects/effects_status_sheet.png',
  arenaBg: '/assets/agentforge/references/arena_reference_lab.png',
} as const;

/* ------------------------------------------------------------------ */
/*  Effect frame constants (effects_status_sheet.png)                 */
/*  Grid: 3 cols x 4 rows, mixed frame sizes                         */
/*  Col 0=shield/patch/status, Col 1=slash/beam/markers, Col 2=burst */
/* ------------------------------------------------------------------ */

export const EFFECT_FRAMES = {
  shieldBurst: frame(0, 0, 96, 96),
  slash: frame(1, 0, 96, 96),
  hitBurst: frame(2, 0, 64, 64),
  patchBeam: frame(0, 1, 64, 128),
  levelUp: frame(1, 1, 96, 96),
  smoke: frame(2, 1, 64, 64),
  warningPing: frame(0, 2, 48, 48),
  passMarker: frame(1, 2, 48, 48),
  failMarker: frame(2, 2, 48, 48),
  healthBar: frame(0, 3, 128, 16),
  shieldBar: frame(1, 3, 128, 16),
} as const;

/* ------------------------------------------------------------------ */
/*  State mapping bridges                                             */
/*  Maps agentforge.ts anim states to sprite atlas internal states    */
/* ------------------------------------------------------------------ */

export const DEFENDER_STATE_MAP: Record<string, DefenderAnimState> = {
  idle: 'idle',
  hit: 'hit',
  upgrading: 'patch',
  defeated: 'broken',
};

export const ENEMY_STATE_MAP: Record<string, EnemyAnimState> = {
  idle: 'idle',
  attacking: 'attack',
  blocked: 'hit',
  successful: 'idle',
  defeated: 'collapse',
};

/* ------------------------------------------------------------------ */
/*  frameStyle – CSS for a single sprite frame                        */
/*  Use with background-image set on the element.                     */
/* ------------------------------------------------------------------ */

export function frameStyle(
  frame: SpriteFrame,
  scale = 1,
): React.CSSProperties {
  return {
    backgroundPosition: `-${frame.x}px -${frame.y}px`,
    width: `${frame.w}px`,
    height: `${frame.h}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    imageRendering: 'pixelated',
  } as React.CSSProperties;
}

/* ------------------------------------------------------------------ */
/*  SpriteSheetRenderer                                               */
/*  Renders an animated div cycling through frames on a timer.        */
/*  Handles loop vs. one-shot animations, fires onAnimEnd on finish.  */
/* ------------------------------------------------------------------ */

export interface SpriteSheetRendererProps {
  /** URL of the sprite sheet image */
  sheetUrl: string;
  /** Animation descriptor (frames + timing) */
  animation: SpriteAnimation;
  /**
   * Unique key that changes when the animation state changes.
   * Resets the frame counter back to 0.
   */
  animKey?: string;
  /** Scale multiplier (1 = native frame size) */
  scale?: number;
  /** Flip horizontally (mirrors the sprite to face the opposite direction) */
  flipX?: boolean;
  className?: string;
  /** Additional inline styles merged on top of frameStyle */
  style?: React.CSSProperties;
  /** Fires once when a non-looping animation reaches its final frame */
  onAnimEnd?: () => void;
}

export function SpriteSheetRenderer({
  sheetUrl,
  animation,
  animKey = '',
  scale = 1,
  flipX = false,
  className,
  style,
  onAnimEnd,
}: SpriteSheetRendererProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const onAnimEndRef = useRef(onAnimEnd);
  const endedRef = useRef(false);
  const frameCount = animation?.frames.length ?? 0;

  useEffect(() => {
    onAnimEndRef.current = onAnimEnd;
  }, [onAnimEnd]);

  // Reset to first frame whenever the animation identity or state key changes
  useEffect(() => {
    if (frameCount === 0) return;
    setFrameIndex(0);
    endedRef.current = false;
  }, [animKey, frameCount, animation.loop]);

  // Drive frame advancement on a timer
  useEffect(() => {
    if (frameCount === 0) return;

    if (frameCount <= 1) {
      // Single-frame: nothing to cycle, but fire onAnimEnd once if non-looping
      if (!animation.loop && !endedRef.current) {
        endedRef.current = true;
        onAnimEndRef.current?.();
      }
      return;
    }

    const id = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (!animation.loop) {
            if (!endedRef.current) {
              endedRef.current = true;
              onAnimEndRef.current?.();
            }
            return prev; // Hold last frame
          }
          return 0; // Wrap around
        }
        return next;
      });
    }, animation.frameTime);

    return () => clearInterval(id);
  }, [animation.frameTime, frameCount, animation.loop, animKey]);

  // Guard: no frames to render
  if (!animation || frameCount === 0) {
    return null;
  }

  // Clamp index to valid range (safe guard)
  const clamped = Math.min(frameIndex, frameCount - 1);
  const f = animation.frames[clamped];

  const transform = flipX
    ? `scaleX(-${scale}) scaleY(${scale})`
    : `scale(${scale})`;

  return (
    <div
      className={className}
      style={{
        ...frameStyle(f, 1),
        backgroundImage: `url(${sheetUrl})`,
        transform,
        transformOrigin: 'top left',
        ...style,
      }}
      aria-hidden
    />
  );
}
