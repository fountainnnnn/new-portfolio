// agentforgeAssets.ts
// Loads the asset-manifest.json data and provides frame URLs.
// Manifest data is hardcoded inline -- no runtime fetch.

export const ASSET_BASE = '/assets/agentforge';

/* ------------------------------------------------------------------ */
/*  Manifest types                                                     */
/* ------------------------------------------------------------------ */

interface HeroManifest {
  [state: string]: string[];
}

interface EnemyStateMap {
  idle: string[];
  approach: string[];
  attack: string[];
  hit: string[];
  defeated: string[];
}

interface EnemyManifest {
  [enemyType: string]: EnemyStateMap;
}

interface EffectManifest {
  [effectType: string]: string[];
}

interface UIManifest {
  [icon: string]: string;
}

interface ArenaManifest {
  cleanLab: string;
}

interface Manifest {
  version: string;
  note: string;
  basePath: string;
  arena: ArenaManifest;
  hero: HeroManifest;
  enemies: EnemyManifest;
  effects: EffectManifest;
  ui: UIManifest;
}

/* ------------------------------------------------------------------ */
/*  Inline manifest data (mirrors assets/asset-manifest.json)         */
/* ------------------------------------------------------------------ */

const MANIFEST: Manifest = {
  version: 'clean-animated-v1',
  note: 'Individual transparent PNG frames. No checkerboard backgrounds.',
  basePath: '/assets/agentforge',
  arena: {
    cleanLab: '/assets/agentforge/arena/arena_lab_clean.png',
  },
  hero: {
    idle: [
      '/assets/agentforge/hero/idle/idle_01.png',
      '/assets/agentforge/hero/idle/idle_02.png',
      '/assets/agentforge/hero/idle/idle_03.png',
      '/assets/agentforge/hero/idle/idle_04.png',
    ],
    run: [
      '/assets/agentforge/hero/run/run_01.png',
      '/assets/agentforge/hero/run/run_02.png',
      '/assets/agentforge/hero/run/run_03.png',
      '/assets/agentforge/hero/run/run_04.png',
      '/assets/agentforge/hero/run/run_05.png',
      '/assets/agentforge/hero/run/run_06.png',
    ],
    attack: [
      '/assets/agentforge/hero/attack/attack_01.png',
      '/assets/agentforge/hero/attack/attack_02.png',
      '/assets/agentforge/hero/attack/attack_03.png',
      '/assets/agentforge/hero/attack/attack_04.png',
      '/assets/agentforge/hero/attack/attack_05.png',
    ],
    defend: [
      '/assets/agentforge/hero/defend/defend_01.png',
      '/assets/agentforge/hero/defend/defend_02.png',
      '/assets/agentforge/hero/defend/defend_03.png',
      '/assets/agentforge/hero/defend/defend_04.png',
    ],
    damaged: [
      '/assets/agentforge/hero/damaged/damaged_01.png',
      '/assets/agentforge/hero/damaged/damaged_02.png',
      '/assets/agentforge/hero/damaged/damaged_03.png',
    ],
    patch: [
      '/assets/agentforge/hero/patch/patch_01.png',
      '/assets/agentforge/hero/patch/patch_02.png',
      '/assets/agentforge/hero/patch/patch_03.png',
      '/assets/agentforge/hero/patch/patch_04.png',
    ],
    broken: [
      '/assets/agentforge/hero/broken/broken_01.png',
      '/assets/agentforge/hero/broken/broken_02.png',
    ],
    victory: [
      '/assets/agentforge/hero/victory/victory_01.png',
      '/assets/agentforge/hero/victory/victory_02.png',
      '/assets/agentforge/hero/victory/victory_03.png',
      '/assets/agentforge/hero/victory/victory_04.png',
    ],
  },
  enemies: {
    prompt_injection: {
      idle: [
        '/assets/agentforge/enemies/prompt_injection/idle/idle_01.png',
        '/assets/agentforge/enemies/prompt_injection/idle/idle_02.png',
        '/assets/agentforge/enemies/prompt_injection/idle/idle_03.png',
      ],
      approach: [
        '/assets/agentforge/enemies/prompt_injection/approach/approach_01.png',
        '/assets/agentforge/enemies/prompt_injection/approach/approach_02.png',
        '/assets/agentforge/enemies/prompt_injection/approach/approach_03.png',
        '/assets/agentforge/enemies/prompt_injection/approach/approach_04.png',
      ],
      attack: [
        '/assets/agentforge/enemies/prompt_injection/attack/attack_01.png',
        '/assets/agentforge/enemies/prompt_injection/attack/attack_02.png',
        '/assets/agentforge/enemies/prompt_injection/attack/attack_03.png',
        '/assets/agentforge/enemies/prompt_injection/attack/attack_04.png',
      ],
      hit: [
        '/assets/agentforge/enemies/prompt_injection/hit/hit_01.png',
        '/assets/agentforge/enemies/prompt_injection/hit/hit_02.png',
      ],
      defeated: [
        '/assets/agentforge/enemies/prompt_injection/defeated/defeated_01.png',
        '/assets/agentforge/enemies/prompt_injection/defeated/defeated_02.png',
      ],
    },
    role_impersonation: {
      idle: [
        '/assets/agentforge/enemies/role_impersonation/idle/idle_01.png',
        '/assets/agentforge/enemies/role_impersonation/idle/idle_02.png',
        '/assets/agentforge/enemies/role_impersonation/idle/idle_03.png',
      ],
      approach: [
        '/assets/agentforge/enemies/role_impersonation/approach/approach_01.png',
        '/assets/agentforge/enemies/role_impersonation/approach/approach_02.png',
        '/assets/agentforge/enemies/role_impersonation/approach/approach_03.png',
        '/assets/agentforge/enemies/role_impersonation/approach/approach_04.png',
      ],
      attack: [
        '/assets/agentforge/enemies/role_impersonation/attack/attack_01.png',
        '/assets/agentforge/enemies/role_impersonation/attack/attack_02.png',
        '/assets/agentforge/enemies/role_impersonation/attack/attack_03.png',
        '/assets/agentforge/enemies/role_impersonation/attack/attack_04.png',
      ],
      hit: [
        '/assets/agentforge/enemies/role_impersonation/hit/hit_01.png',
        '/assets/agentforge/enemies/role_impersonation/hit/hit_02.png',
      ],
      defeated: [
        '/assets/agentforge/enemies/role_impersonation/defeated/defeated_01.png',
        '/assets/agentforge/enemies/role_impersonation/defeated/defeated_02.png',
      ],
    },
    emotional_manipulation: {
      idle: [
        '/assets/agentforge/enemies/emotional_manipulation/idle/idle_01.png',
        '/assets/agentforge/enemies/emotional_manipulation/idle/idle_02.png',
        '/assets/agentforge/enemies/emotional_manipulation/idle/idle_03.png',
      ],
      approach: [
        '/assets/agentforge/enemies/emotional_manipulation/approach/approach_01.png',
        '/assets/agentforge/enemies/emotional_manipulation/approach/approach_02.png',
        '/assets/agentforge/enemies/emotional_manipulation/approach/approach_03.png',
        '/assets/agentforge/enemies/emotional_manipulation/approach/approach_04.png',
      ],
      attack: [
        '/assets/agentforge/enemies/emotional_manipulation/attack/attack_01.png',
        '/assets/agentforge/enemies/emotional_manipulation/attack/attack_02.png',
        '/assets/agentforge/enemies/emotional_manipulation/attack/attack_03.png',
        '/assets/agentforge/enemies/emotional_manipulation/attack/attack_04.png',
      ],
      hit: [
        '/assets/agentforge/enemies/emotional_manipulation/hit/hit_01.png',
        '/assets/agentforge/enemies/emotional_manipulation/hit/hit_02.png',
      ],
      defeated: [
        '/assets/agentforge/enemies/emotional_manipulation/defeated/defeated_01.png',
        '/assets/agentforge/enemies/emotional_manipulation/defeated/defeated_02.png',
      ],
    },
    tool_abuse: {
      idle: [
        '/assets/agentforge/enemies/tool_abuse/idle/idle_01.png',
        '/assets/agentforge/enemies/tool_abuse/idle/idle_02.png',
        '/assets/agentforge/enemies/tool_abuse/idle/idle_03.png',
      ],
      approach: [
        '/assets/agentforge/enemies/tool_abuse/approach/approach_01.png',
        '/assets/agentforge/enemies/tool_abuse/approach/approach_02.png',
        '/assets/agentforge/enemies/tool_abuse/approach/approach_03.png',
        '/assets/agentforge/enemies/tool_abuse/approach/approach_04.png',
      ],
      attack: [
        '/assets/agentforge/enemies/tool_abuse/attack/attack_01.png',
        '/assets/agentforge/enemies/tool_abuse/attack/attack_02.png',
        '/assets/agentforge/enemies/tool_abuse/attack/attack_03.png',
        '/assets/agentforge/enemies/tool_abuse/attack/attack_04.png',
      ],
      hit: [
        '/assets/agentforge/enemies/tool_abuse/hit/hit_01.png',
        '/assets/agentforge/enemies/tool_abuse/hit/hit_02.png',
      ],
      defeated: [
        '/assets/agentforge/enemies/tool_abuse/defeated/defeated_01.png',
        '/assets/agentforge/enemies/tool_abuse/defeated/defeated_02.png',
      ],
    },
    policy_extraction: {
      idle: [
        '/assets/agentforge/enemies/policy_extraction/idle/idle_01.png',
        '/assets/agentforge/enemies/policy_extraction/idle/idle_02.png',
        '/assets/agentforge/enemies/policy_extraction/idle/idle_03.png',
      ],
      approach: [
        '/assets/agentforge/enemies/policy_extraction/approach/approach_01.png',
        '/assets/agentforge/enemies/policy_extraction/approach/approach_02.png',
        '/assets/agentforge/enemies/policy_extraction/approach/approach_03.png',
        '/assets/agentforge/enemies/policy_extraction/approach/approach_04.png',
      ],
      attack: [
        '/assets/agentforge/enemies/policy_extraction/attack/attack_01.png',
        '/assets/agentforge/enemies/policy_extraction/attack/attack_02.png',
        '/assets/agentforge/enemies/policy_extraction/attack/attack_03.png',
        '/assets/agentforge/enemies/policy_extraction/attack/attack_04.png',
      ],
      hit: [
        '/assets/agentforge/enemies/policy_extraction/hit/hit_01.png',
        '/assets/agentforge/enemies/policy_extraction/hit/hit_02.png',
      ],
      defeated: [
        '/assets/agentforge/enemies/policy_extraction/defeated/defeated_01.png',
        '/assets/agentforge/enemies/policy_extraction/defeated/defeated_02.png',
      ],
    },
    multi_turn_escalation: {
      idle: [
        '/assets/agentforge/enemies/multi_turn_escalation/idle/idle_01.png',
        '/assets/agentforge/enemies/multi_turn_escalation/idle/idle_02.png',
        '/assets/agentforge/enemies/multi_turn_escalation/idle/idle_03.png',
      ],
      approach: [
        '/assets/agentforge/enemies/multi_turn_escalation/approach/approach_01.png',
        '/assets/agentforge/enemies/multi_turn_escalation/approach/approach_02.png',
        '/assets/agentforge/enemies/multi_turn_escalation/approach/approach_03.png',
        '/assets/agentforge/enemies/multi_turn_escalation/approach/approach_04.png',
      ],
      attack: [
        '/assets/agentforge/enemies/multi_turn_escalation/attack/attack_01.png',
        '/assets/agentforge/enemies/multi_turn_escalation/attack/attack_02.png',
        '/assets/agentforge/enemies/multi_turn_escalation/attack/attack_03.png',
        '/assets/agentforge/enemies/multi_turn_escalation/attack/attack_04.png',
      ],
      hit: [
        '/assets/agentforge/enemies/multi_turn_escalation/hit/hit_01.png',
        '/assets/agentforge/enemies/multi_turn_escalation/hit/hit_02.png',
      ],
      defeated: [
        '/assets/agentforge/enemies/multi_turn_escalation/defeated/defeated_01.png',
        '/assets/agentforge/enemies/multi_turn_escalation/defeated/defeated_02.png',
      ],
    },
  },
  effects: {
    shield_burst: [
      '/assets/agentforge/effects/shield_burst/shield_burst_01.png',
      '/assets/agentforge/effects/shield_burst/shield_burst_02.png',
      '/assets/agentforge/effects/shield_burst/shield_burst_03.png',
      '/assets/agentforge/effects/shield_burst/shield_burst_04.png',
      '/assets/agentforge/effects/shield_burst/shield_burst_05.png',
      '/assets/agentforge/effects/shield_burst/shield_burst_06.png',
    ],
    slash: [
      '/assets/agentforge/effects/slash/slash_01.png',
      '/assets/agentforge/effects/slash/slash_02.png',
      '/assets/agentforge/effects/slash/slash_03.png',
      '/assets/agentforge/effects/slash/slash_04.png',
      '/assets/agentforge/effects/slash/slash_05.png',
    ],
    projectile: [
      '/assets/agentforge/effects/projectile/projectile_01.png',
      '/assets/agentforge/effects/projectile/projectile_02.png',
      '/assets/agentforge/effects/projectile/projectile_03.png',
      '/assets/agentforge/effects/projectile/projectile_04.png',
      '/assets/agentforge/effects/projectile/projectile_05.png',
      '/assets/agentforge/effects/projectile/projectile_06.png',
    ],
    hit_spark: [
      '/assets/agentforge/effects/hit_spark/hit_spark_01.png',
      '/assets/agentforge/effects/hit_spark/hit_spark_02.png',
      '/assets/agentforge/effects/hit_spark/hit_spark_03.png',
      '/assets/agentforge/effects/hit_spark/hit_spark_04.png',
      '/assets/agentforge/effects/hit_spark/hit_spark_05.png',
    ],
    patch_beam: [
      '/assets/agentforge/effects/patch_beam/patch_beam_01.png',
      '/assets/agentforge/effects/patch_beam/patch_beam_02.png',
      '/assets/agentforge/effects/patch_beam/patch_beam_03.png',
      '/assets/agentforge/effects/patch_beam/patch_beam_04.png',
      '/assets/agentforge/effects/patch_beam/patch_beam_05.png',
      '/assets/agentforge/effects/patch_beam/patch_beam_06.png',
    ],
    level_up: [
      '/assets/agentforge/effects/level_up/level_up_01.png',
      '/assets/agentforge/effects/level_up/level_up_02.png',
      '/assets/agentforge/effects/level_up/level_up_03.png',
      '/assets/agentforge/effects/level_up/level_up_04.png',
      '/assets/agentforge/effects/level_up/level_up_05.png',
      '/assets/agentforge/effects/level_up/level_up_06.png',
    ],
    smoke: [
      '/assets/agentforge/effects/smoke/smoke_01.png',
      '/assets/agentforge/effects/smoke/smoke_02.png',
      '/assets/agentforge/effects/smoke/smoke_03.png',
      '/assets/agentforge/effects/smoke/smoke_04.png',
      '/assets/agentforge/effects/smoke/smoke_05.png',
    ],
    warning: [
      '/assets/agentforge/effects/warning/warning_01.png',
      '/assets/agentforge/effects/warning/warning_02.png',
      '/assets/agentforge/effects/warning/warning_03.png',
    ],
  },
  ui: {
    play: '/assets/agentforge/ui/play.png',
    export: '/assets/agentforge/ui/export.png',
    patch: '/assets/agentforge/ui/patch.png',
    log: '/assets/agentforge/ui/log.png',
  },
};

/* ------------------------------------------------------------------ */
/*  State and type constants                                          */
/* ------------------------------------------------------------------ */

export const HERO_STATES = [
  'idle',
  'run',
  'attack',
  'defend',
  'damaged',
  'patch',
  'broken',
  'victory',
] as const;

export const ENEMY_STATES = [
  'idle',
  'approach',
  'attack',
  'hit',
  'defeated',
] as const;

export const EFFECT_TYPES = [
  'shield_burst',
  'slash',
  'projectile',
  'hit_spark',
  'patch_beam',
  'level_up',
  'smoke',
  'warning',
] as const;

export const ENEMY_TYPES = [
  'prompt_injection',
  'role_impersonation',
  'emotional_manipulation',
  'tool_abuse',
  'policy_extraction',
  'multi_turn_escalation',
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns the frame URLs for the requested hero animation state.
 * Falls back to idle frames if the requested state is missing.
 * Never returns an empty array.
 */
export function getHeroFrames(state: string): string[] {
  const frames = MANIFEST.hero[state];
  if (frames && frames.length > 0) {
    return frames;
  }
  // Fallback to idle
  return MANIFEST.hero.idle;
}

/**
 * Returns the frame URLs for the requested enemy animation state.
 * Falls back to idle frames if the requested state or enemy type is missing.
 * Never returns an empty array.
 */
export function getEnemyFrames(enemyType: string, state: string): string[] {
  const enemy = MANIFEST.enemies[enemyType];
  if (!enemy) {
    return MANIFEST.enemies.prompt_injection.idle;
  }
  const frames = enemy[state as keyof EnemyStateMap];
  if (frames && frames.length > 0) {
    return frames;
  }
  // Fallback to idle for this enemy
  return enemy.idle;
}

/**
 * Returns the frame URLs for the requested effect animation.
 * Returns an empty array if the effect type is unknown (caller should handle fallback).
 */
export function getEffectFrames(effectType: string): string[] {
  const frames = MANIFEST.effects[effectType];
  return frames || [];
}

/**
 * Returns the arena background image URL.
 */
export function getArenaBackground(): string {
  return MANIFEST.arena.cleanLab;
}

/**
 * Returns the UI icon URL for the given icon name.
 * Returns an empty string if the icon is not found.
 */
export function getUIIcon(icon: string): string {
  return MANIFEST.ui[icon] || '';
}
