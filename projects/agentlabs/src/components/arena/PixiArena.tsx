
import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import type { AttackScenario, BattleEvent } from "@/types/agentforge";

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

export interface PixiArenaProps {
  width: number;
  height: number;
  mode: "agent_hardening" | "rl_lab";
  wave: number;
  combatants: AttackScenario[];
  events: BattleEvent[];
  defenderState: string;
  enemyStates: Record<string, string>;
  integrity: number;
  shield: number;
  score: number;
  currentAttackIndex: number;
  isWaveComplete: boolean;
  narration: string;
  animationSpeed: number;
  onAttackResolved?: (attackId: string, result: "blocked" | "failed") => void;
  onWaveComplete?: () => void;
  bossWave: boolean;
}

type CombatPhaseName =
  | "idle"
  | "enemy_select"
  | "enemy_approach"
  | "enemy_windup"
  | "projectile_travel"
  | "block_damage"
  | "defender_react"
  | "enemy_recover"
  | "complete";

interface CombatSequence {
  active: boolean;
  phase: CombatPhaseName;
  phaseTimer: number;
  phaseDuration: number;
  attackIndex: number;
  attackId: string;
  attackerType: string;
  result: "blocked" | "failed";
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  projFromX: number;
  projFromY: number;
  projToX: number;
  projToY: number;
}

interface AnimatedSpriteData {
  sprite: PIXI.Sprite;
  currentAnim: string;
  frameIndex: number;
  frameTimer: number;
  textures: Record<string, PIXI.Texture[]>;
  frameTimes: Record<string, number>;
  loops: Record<string, boolean>;
  baseScale: number;
  flipX: boolean;
}

interface EffectInstance {
  container: PIXI.Container;
  sprite: PIXI.Sprite;
  textures: PIXI.Texture[];
  frameIndex: number;
  frameTimer: number;
  frameTime: number;
  x: number;
  y: number;
  life: number;
  done: boolean;
}

/* ================================================================== */
/*  Constants — asset paths from asset-manifest.json                  */
/* ================================================================== */

const ARENA_BG = "/assets/agentforge/arena/arena_lab_clean.png";

const HERO_FRAMES: Record<string, string[]> = {
  idle: [
    "/assets/agentforge/hero/idle/idle_01.png",
    "/assets/agentforge/hero/idle/idle_02.png",
    "/assets/agentforge/hero/idle/idle_03.png",
    "/assets/agentforge/hero/idle/idle_04.png",
  ],
  defend: [
    "/assets/agentforge/hero/defend/defend_01.png",
    "/assets/agentforge/hero/defend/defend_02.png",
    "/assets/agentforge/hero/defend/defend_03.png",
    "/assets/agentforge/hero/defend/defend_04.png",
  ],
  damaged: [
    "/assets/agentforge/hero/damaged/damaged_01.png",
    "/assets/agentforge/hero/damaged/damaged_02.png",
    "/assets/agentforge/hero/damaged/damaged_03.png",
  ],
  patch: [
    "/assets/agentforge/hero/patch/patch_01.png",
    "/assets/agentforge/hero/patch/patch_02.png",
    "/assets/agentforge/hero/patch/patch_03.png",
    "/assets/agentforge/hero/patch/patch_04.png",
  ],
  victory: [
    "/assets/agentforge/hero/victory/victory_01.png",
    "/assets/agentforge/hero/victory/victory_02.png",
    "/assets/agentforge/hero/victory/victory_03.png",
    "/assets/agentforge/hero/victory/victory_04.png",
  ],
  broken: [
    "/assets/agentforge/hero/broken/broken_01.png",
    "/assets/agentforge/hero/broken/broken_02.png",
  ],
};

const ENEMY_TYPES_LIST = [
  "prompt_injection",
  "role_impersonation",
  "emotional_manipulation",
  "tool_abuse",
  "policy_extraction",
  "multi_turn_escalation",
] as const;

const ENEMY_STATES_LIST = ["idle", "approach", "attack", "hit", "defeated"] as const;

const EFFECT_PATHS: Record<string, string[]> = {
  shield_burst: [
    "/assets/agentforge/effects/shield_burst/shield_burst_01.png",
    "/assets/agentforge/effects/shield_burst/shield_burst_02.png",
    "/assets/agentforge/effects/shield_burst/shield_burst_03.png",
    "/assets/agentforge/effects/shield_burst/shield_burst_04.png",
    "/assets/agentforge/effects/shield_burst/shield_burst_05.png",
    "/assets/agentforge/effects/shield_burst/shield_burst_06.png",
  ],
  hit_spark: [
    "/assets/agentforge/effects/hit_spark/hit_spark_01.png",
    "/assets/agentforge/effects/hit_spark/hit_spark_02.png",
    "/assets/agentforge/effects/hit_spark/hit_spark_03.png",
    "/assets/agentforge/effects/hit_spark/hit_spark_04.png",
    "/assets/agentforge/effects/hit_spark/hit_spark_05.png",
  ],
  projectile: [
    "/assets/agentforge/effects/projectile/projectile_01.png",
    "/assets/agentforge/effects/projectile/projectile_02.png",
    "/assets/agentforge/effects/projectile/projectile_03.png",
    "/assets/agentforge/effects/projectile/projectile_04.png",
    "/assets/agentforge/effects/projectile/projectile_05.png",
    "/assets/agentforge/effects/projectile/projectile_06.png",
  ],
  patch_beam: [
    "/assets/agentforge/effects/patch_beam/patch_beam_01.png",
    "/assets/agentforge/effects/patch_beam/patch_beam_02.png",
    "/assets/agentforge/effects/patch_beam/patch_beam_03.png",
    "/assets/agentforge/effects/patch_beam/patch_beam_04.png",
    "/assets/agentforge/effects/patch_beam/patch_beam_05.png",
    "/assets/agentforge/effects/patch_beam/patch_beam_06.png",
  ],
  level_up: [
    "/assets/agentforge/effects/level_up/level_up_01.png",
    "/assets/agentforge/effects/level_up/level_up_02.png",
    "/assets/agentforge/effects/level_up/level_up_03.png",
    "/assets/agentforge/effects/level_up/level_up_04.png",
    "/assets/agentforge/effects/level_up/level_up_05.png",
    "/assets/agentforge/effects/level_up/level_up_06.png",
  ],
  smoke: [
    "/assets/agentforge/effects/smoke/smoke_01.png",
    "/assets/agentforge/effects/smoke/smoke_02.png",
    "/assets/agentforge/effects/smoke/smoke_03.png",
    "/assets/agentforge/effects/smoke/smoke_04.png",
    "/assets/agentforge/effects/smoke/smoke_05.png",
  ],
  warning: [
    "/assets/agentforge/effects/warning/warning_01.png",
    "/assets/agentforge/effects/warning/warning_02.png",
    "/assets/agentforge/effects/warning/warning_03.png",
  ],
};

/* Inline timings (from arenaAnimationTimings.ts) */
const PHASE_DURATIONS: Record<string, number> = {
  enemy_select: 300,
  enemy_approach: 800,
  enemy_windup: 400,
  projectile_travel: 500,
  block_damage: 500,
  defender_react: 500,
  enemy_recover: 500,
};

const ANIM_FRAME_TIMES: Record<string, number> = {
  idle: 200,
  approach: 120,
  attack: 100,
  hit: 150,
  defeated: 250,
  defend: 250,
  damaged: 150,
  patch: 300,
  victory: 400,
  broken: 500,
};

const ANIM_LOOPS: Record<string, boolean> = {
  idle: true,
  approach: false,
  attack: false,
  hit: false,
  defeated: false,
  defend: false,
  damaged: false,
  patch: false,
  victory: true,
  broken: false,
};

/* ---- Layout constants ---- */
const DEFENDER_X_RATIO = 0.29;
const DEFENDER_Y_RATIO = 0.54;
const ENEMY_POSITIONS: { x: number; y: number }[] = [
  { x: 0.62, y: 0.26 },
  { x: 0.74, y: 0.32 },
  { x: 0.66, y: 0.44 },
  { x: 0.78, y: 0.52 },
  { x: 0.64, y: 0.64 },
  { x: 0.76, y: 0.72 },
  { x: 0.86, y: 0.40 },
  { x: 0.86, y: 0.62 },
];

const GRID_COLOR = 0x6e82a0;
const GRID_ALPHA = 0.04;
const GRID_SIZE_PX = 32;

const ENEMY_APPROACH_X_OFFSET = 112;
const BOB_AMPLITUDE = 2;
const BOB_SPEED = 0.03;

/* ---- Enemy type colors for fallback ---- */
const ENEMY_COLORS: Record<string, number> = {
  prompt_injection: 0xff5c7a,
  role_impersonation: 0xa78bfa,
  emotional_manipulation: 0xf97316,
  tool_abuse: 0xeab308,
  policy_extraction: 0x22d3ee,
  multi_turn_escalation: 0xef4444,
};

const DEFENDER_COLOR = 0x6b7280;
const FALLBACK_SIZE = 48;

/* ---- Defender state mapping ---- */
function mapDefenderState(s: string): string {
  switch (s) {
    case "idle":
      return "idle";
    case "defend":
      return "defend";
    case "hit":
    case "damaged":
      return "damaged";
    case "patch":
    case "patching":
      return "patch";
    case "upgraded":
    case "victory":
      return "victory";
    case "defeated":
    case "broken":
      return "broken";
    default:
      return "idle";
  }
}

/* ================================================================== */
/*  Math helpers                                                      */
/* ================================================================== */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatAttackCounter(
  currentIndex: number,
  total: number,
  status: string,
): string {
  if (status === "waveComplete") return "Wave Complete";
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(currentIndex + 1, 1), safeTotal);
  return `Attack ${String(safeCurrent).padStart(2, "0")}/${String(safeTotal).padStart(2, "0")}`;
}

function inferCombatResult(attack: AttackScenario): "blocked" | "failed" {
  if (attack.status === "blocked" || attack.status === "passed") return "blocked";
  if (attack.status === "failed") return "failed";
  return ["prompt_injection", "role_impersonation", "policy_extraction"].includes(
    attack.category,
  )
    ? "failed"
    : "blocked";
}

/* ================================================================== */
/*  Texture loading                                                    */
/* ================================================================== */

const textureCache = new Map<string, PIXI.Texture | null>();

async function loadTexture(url: string): Promise<PIXI.Texture | null> {
  if (textureCache.has(url)) return textureCache.get(url) ?? null;
  try {
    /* Resolve relative URLs to absolute so the browser resolves reliably */
    const resolvedUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    /* Use native Image API instead of PIXI.Assets.load to avoid Turbopack pre-transform interference */
    const tex = await new Promise<PIXI.Texture | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          /* PixiJS v8: Texture.from() accepts HTMLImageElement */
          const texture = PIXI.Texture.from(img);
          if (texture?.source) {
            try { (texture.source as any).scaleMode = 'nearest'; } catch { /* v8 */ }
          }
          textureCache.set(url, texture);
          resolve(texture);
        } catch (innerErr) {
          console.warn(`[PixiArena] Failed to create texture from ${url}:`, innerErr);
          textureCache.set(url, null);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.warn(`[PixiArena] Failed to load image: ${resolvedUrl}`);
        textureCache.set(url, null);
        resolve(null);
      };
      img.src = resolvedUrl;
    });
    return tex;
  } catch {
    textureCache.set(url, null);
    return null;
  }
}

async function loadTextureArray(urls: string[]): Promise<PIXI.Texture[]> {
  const results = await Promise.all(urls.map((u) => loadTexture(u)));
  return results.filter((t): t is PIXI.Texture => t !== null);
}

async function preloadHeroTextures(): Promise<Record<string, PIXI.Texture[]>> {
  const r: Record<string, PIXI.Texture[]> = {};
  for (const [key, urls] of Object.entries(HERO_FRAMES)) {
    r[key] = await loadTextureArray(urls);
  }
  return r;
}

async function preloadEnemyTextures(): Promise<Record<string, Record<string, PIXI.Texture[]>>> {
  const r: Record<string, Record<string, PIXI.Texture[]>> = {};
  for (const etype of ENEMY_TYPES_LIST) {
    r[etype] = {};
    for (const state of ENEMY_STATES_LIST) {
      const counts: Record<string, number> = { idle: 3, approach: 4, attack: 4, hit: 2, defeated: 2 };
      const maxFrames = counts[state] ?? 2;
      const urls: string[] = [];
      for (let i = 1; i <= maxFrames; i++) {
        urls.push(`/assets/agentforge/enemies/${etype}/${state}/${state}_${String(i).padStart(2, '0')}.png`);
      }
      r[etype][state] = await loadTextureArray(urls);
    }
  }
  return r;
}

async function preloadEffectTextures(): Promise<Record<string, PIXI.Texture[]>> {
  const r: Record<string, PIXI.Texture[]> = {};
  for (const [key, urls] of Object.entries(EFFECT_PATHS)) {
    r[key] = await loadTextureArray(urls);
  }
  return r;
}

/* ================================================================== */
/*  Fallback creation — never show white squares/checkerboards        */
/* ================================================================== */

function createFallbackSprite(w: number, h: number, label: string, color: number): PIXI.Container {
  const c = new PIXI.Container();
  const bg = new PIXI.Graphics();
  bg.rect(-w / 2, -h / 2, w, h).fill({ color, alpha: 0.85 });
  bg.rect(-w / 2, -h / 2, w, h).stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  c.addChild(bg);
  if (label) {
    const txt = new PIXI.Text({
      text: label,
      style: { fontFamily: "monospace", fontSize: 8, fill: "#ffffff" },
    });
    txt.anchor.set(0.5);
    c.addChild(txt);
  }
  return c;
}

function makeAnimatedSprite(
  textures: Record<string, PIXI.Texture[]>,
  initialState: string,
  scale: number,
  fallbackColor: number,
  fallbackLabel: string,
  flipX = false,
): AnimatedSpriteData {
  const firstTex = textures[initialState]?.[0] ?? null;
  let sprite: PIXI.Sprite;
  if (firstTex) {
    sprite = new PIXI.Sprite(firstTex);
  } else {
    sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  }
  sprite.anchor.set(0.5);
  sprite.scale.set(flipX ? -scale : scale, scale);

  const frameTimes: Record<string, number> = {};
  const loops: Record<string, boolean> = {};
  for (const key of Object.keys(textures)) {
    frameTimes[key] = ANIM_FRAME_TIMES[key] ?? 200;
    loops[key] = ANIM_LOOPS[key] ?? false;
  }

  return {
    sprite,
    currentAnim: initialState,
    frameIndex: 0,
    frameTimer: 0,
    textures,
    frameTimes,
    loops,
    baseScale: scale,
    flipX,
  };
}

function switchAnim(data: AnimatedSpriteData, newAnim: string): void {
  if (data.currentAnim === newAnim) return;
  data.currentAnim = newAnim;
  data.frameIndex = 0;
  data.frameTimer = 0;
  const frames = data.textures[newAnim];
  if (frames && frames.length > 0 && data.sprite.texture !== frames[0]) {
    data.sprite.texture = frames[0];
  } else if (!frames || frames.length === 0) {
    data.sprite.texture = PIXI.Texture.EMPTY;
  }
}

function tickAnimation(data: AnimatedSpriteData, dt: number): void {
  const frames = data.textures[data.currentAnim];
  if (!frames || frames.length === 0) return;
  const ft = data.frameTimes[data.currentAnim] ?? 200;
  data.frameTimer += dt;
  while (data.frameTimer >= ft) {
    data.frameTimer -= ft;
    data.frameIndex++;
    if (data.frameIndex >= frames.length) {
      if (data.loops[data.currentAnim]) {
        data.frameIndex = 0;
      } else {
        data.frameIndex = frames.length - 1;
      }
    }
  }
  const idx = clamp(data.frameIndex, 0, frames.length - 1);
  if (frames[idx] && data.sprite.texture !== frames[idx]) {
    data.sprite.texture = frames[idx];
  }
}

/* ================================================================== */
/*  Component                                                         */
/* ================================================================== */

export default function PixiArena({
  width,
  height,
  mode,
  wave,
  combatants,
  events,
  defenderState,
  enemyStates,
  integrity,
  shield,
  score,
  currentAttackIndex,
  isWaveComplete,
  narration,
  animationSpeed,
  onAttackResolved,
  onWaveComplete,
  bossWave,
}: PixiArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  /* ---- Layer refs ---- */
  const bgLayerRef = useRef<PIXI.Container | null>(null);
  const gridLayerRef = useRef<PIXI.Container | null>(null);
  const shadowLayerRef = useRef<PIXI.Container | null>(null);
  const enemyLayerRef = useRef<PIXI.Container | null>(null);
  const defenderLayerRef = useRef<PIXI.Container | null>(null);
  const effectLayerRef = useRef<PIXI.Container | null>(null);
  const hudLayerRef = useRef<PIXI.Container | null>(null);
  const narrationLayerRef = useRef<PIXI.Container | null>(null);

  /* ---- Sprite refs ---- */
  const defenderAnimRef = useRef<AnimatedSpriteData | null>(null);
  const enemyAnimRefs = useRef<Map<string, AnimatedSpriteData>>(new Map());
  const enemyContainerRefs = useRef<Map<string, PIXI.Container>>(new Map());
  const enemyOriginRefs = useRef<Map<string, { x: number; y: number }>>(new Map());
  const projectileRef = useRef<PIXI.Container | null>(null);
  const projectileSpriteRef = useRef<PIXI.Sprite | null>(null);
  const effectRefs = useRef<EffectInstance[]>([]);
  const fallbackEnemies = useRef<Map<string, PIXI.Container>>(new Map());
  const prevCombatantIdsRef = useRef("");

  /* ---- Combat sequence ---- */
  const combatRef = useRef<CombatSequence>({
    active: false,
    phase: "idle",
    phaseTimer: 0,
    phaseDuration: 0,
    attackIndex: -1,
    attackId: "",
    attackerType: "",
    result: "blocked",
    originX: 0,
    originY: 0,
    targetX: 0,
    targetY: 0,
    projFromX: 0,
    projFromY: 0,
    projToX: 0,
    projToY: 0,
  });

  /* ---- HUD refs ---- */
  const hudRefs = useRef<{
    waveText: PIXI.Text;
    attackText: PIXI.Text;
    modeText: PIXI.Text;
    integrityLabel: PIXI.Text;
    shieldLabel: PIXI.Text;
    integrityBarBg: PIXI.Graphics;
    integrityBarFill: PIXI.Graphics;
    shieldBarBg: PIXI.Graphics;
    shieldBarFill: PIXI.Graphics;
    scoreText: PIXI.Text;
    narrationBg: PIXI.Graphics;
    narrationText: PIXI.Text;
  } | null>(null);

  /* ---- Texture stores ---- */
  const heroTexRef = useRef<Record<string, PIXI.Texture[]>>({});
  const enemyTexRef = useRef<Record<string, Record<string, PIXI.Texture[]>>>({});
  const effectTexRef = useRef<Record<string, PIXI.Texture[]>>({});

  /* ---- Misc refs ---- */
  const dimsRef = useRef({ width, height });
  const speedRef = useRef(animationSpeed);
  const prevAtkIdxRef = useRef(-1);
  const prevDefStateRef = useRef("");
  const waveCompleteFiredRef = useRef(false);
  const initGuardRef = useRef(false);
  const bobTimerRef = useRef(0);
  const [texturesReady, setTexturesReady] = useState(false);

  dimsRef.current = { width, height };
  speedRef.current = animationSpeed;

  /* ---- Combat result capture ---- */
  const onAttackResolvedRef = useRef(onAttackResolved);
  const onWaveCompleteRef = useRef(onWaveComplete);
  onAttackResolvedRef.current = onAttackResolved;
  onWaveCompleteRef.current = onWaveComplete;

  function rebuildEnemySprites(nextCombatants: AttackScenario[]): void {
    const enemyLayer = enemyLayerRef.current;
    if (!enemyLayer) return;

    enemyLayer.removeChildren();
    enemyAnimRefs.current.clear();
    enemyContainerRefs.current.clear();
    enemyOriginRefs.current.clear();
    fallbackEnemies.current.clear();

    const { width: w, height: h } = dimsRef.current;

    for (let i = 0; i < Math.min(nextCombatants.length, ENEMY_POSITIONS.length); i++) {
      const atk = nextCombatants[i];
      const pos = ENEMY_POSITIONS[i];
      const ex = w * pos.x;
      const ey = h * pos.y;
      const etype = atk.category;
      const isBoss = etype === "multi_turn_escalation";
      const scale = isBoss ? 1.6 : 1.3;
      const eColor = ENEMY_COLORS[etype] ?? 0xff5c7a;

      const hasTex = (enemyTexRef.current[etype]?.idle?.length ?? 0) > 0;
      if (hasTex) {
        const eAnim = makeAnimatedSprite(
          enemyTexRef.current[etype] ?? {},
          "idle",
          scale,
          eColor,
          etype.slice(0, 4).toUpperCase(),
          true,
        );
        eAnim.sprite.x = ex;
        eAnim.sprite.y = ey;
        enemyLayer.addChild(eAnim.sprite);
        enemyAnimRefs.current.set(atk.id, eAnim);
        enemyOriginRefs.current.set(atk.id, { x: ex, y: ey });
      } else {
        console.warn(`[PixiArena] Enemy ${etype} idle textures failed to load, using fallback`);
        const fb = createFallbackSprite(32, 32, etype.slice(0, 3).toUpperCase(), eColor);
        fb.x = ex;
        fb.y = ey;
        enemyLayer.addChild(fb);
        fallbackEnemies.current.set(atk.id, fb);
      }
    }
  }

  function resetEnemyToOrigin(attackId: string, state: string = "idle"): void {
    const eAnim = enemyAnimRefs.current.get(attackId);
    const origin = enemyOriginRefs.current.get(attackId);
    if (!eAnim || !origin) return;

    eAnim.sprite.x = origin.x;
    eAnim.sprite.y = origin.y;
    eAnim.sprite.scale.set(eAnim.flipX ? -eAnim.baseScale : eAnim.baseScale, eAnim.baseScale);
    eAnim.sprite.alpha = 1;
    switchAnim(eAnim, state);
  }

  /* ================================================================ */
  /*  MOUNT EFFECT                                                    */
  /* ================================================================ */
  useEffect(() => {
    if (initGuardRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const { width: w, height: h } = dimsRef.current;
    initGuardRef.current = true;

    (async () => {
      const app = new PIXI.Application();
      await app.init({
        width: w,
        height: h,
        background: "#FCFCF7",
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      /* ---- Set pixel-art scale mode per-texture (PixiJS v8) ---- */

      const canvas = app.canvas as HTMLCanvasElement;
      if (canvas) {
        canvas.style.display = "block";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        container.appendChild(canvas);
      }

      appRef.current = app;

      /* ---- Preload all textures ---- */
      heroTexRef.current = await preloadHeroTextures();
      enemyTexRef.current = await preloadEnemyTextures();
      effectTexRef.current = await preloadEffectTextures();

      /* Debug: verify texture loading */
      console.log('[PixiArena] Hero idle texture count:', heroTexRef.current.idle?.length ?? 0);
      console.log('[PixiArena] Enemy prompt_injection idle count:', enemyTexRef.current.prompt_injection?.idle?.length ?? 0);
      console.log('[PixiArena] Effect shield_burst count:', effectTexRef.current.shield_burst?.length ?? 0);

      /* ---- Create layers (bottom to top) ---- */
      const bgLayer = new PIXI.Container();
      const gridLayer = new PIXI.Container();
      const shadowLayer = new PIXI.Container();
      const enemyLayer = new PIXI.Container();
      const defenderLayer = new PIXI.Container();
      const effectLayer = new PIXI.Container();
      const hudLayer = new PIXI.Container();
      const narrationLayer = new PIXI.Container();

      app.stage.addChild(
        bgLayer,
        gridLayer,
        shadowLayer,
        enemyLayer,
        defenderLayer,
        effectLayer,
        hudLayer,
        narrationLayer,
      );

      bgLayerRef.current = bgLayer;
      gridLayerRef.current = gridLayer;
      shadowLayerRef.current = shadowLayer;
      enemyLayerRef.current = enemyLayer;
      defenderLayerRef.current = defenderLayer;
      effectLayerRef.current = effectLayer;
      hudLayerRef.current = hudLayer;
      narrationLayerRef.current = narrationLayer;

      /* ---- Background ---- */
      const bgTex = await loadTexture(ARENA_BG);
      if (bgTex) {
        const bgSprite = new PIXI.Sprite(bgTex);
        const sx = w / (bgTex.width || w);
        const sy = h / (bgTex.height || h);
        bgSprite.scale.set(Math.max(sx, sy));
        bgSprite.anchor.set(0.5);
        bgSprite.x = w / 2;
        bgSprite.y = h / 2;
        bgLayer.addChild(bgSprite);
      } else {
        const fb = new PIXI.Graphics();
        fb.rect(0, 0, w, h).fill({ color: 0xfcfcf7 });
        bgLayer.addChild(fb);
      }

      /* ---- Grid overlay (very faint, optional) ---- */
      const grid = new PIXI.Graphics();
      const gridAlpha = 0.02;
      for (let x = 0; x <= w; x += GRID_SIZE_PX) {
        grid.moveTo(x, 0).lineTo(x, h);
      }
      for (let y = 0; y <= h; y += GRID_SIZE_PX) {
        grid.moveTo(0, y).lineTo(w, y);
      }
      grid.stroke({ width: 1, color: 0x999999, alpha: gridAlpha });
      gridLayer.addChild(grid);

      /* ---- Floor shadow layer ---- */
      const floorShadow = new PIXI.Graphics();
      floorShadow.rect(0, h * 0.75, w, h * 0.25).fill({ color: 0x000000, alpha: 0.08 });
      shadowLayer.addChild(floorShadow);

      /* ---- Defender (animated sprite OR fallback, never both) ---- */
      const defX = w * DEFENDER_X_RATIO;
      const defY = h * DEFENDER_Y_RATIO;

      const defHasTex = heroTexRef.current.idle?.length > 0;
      if (defHasTex) {
        const defAnim = makeAnimatedSprite(
          heroTexRef.current,
          "idle",
          1.5,
          DEFENDER_COLOR,
          "D",
        );
        defAnim.sprite.x = defX;
        defAnim.sprite.y = defY;
        defenderLayer.addChild(defAnim.sprite);
        defenderAnimRef.current = defAnim;
      } else {
        console.warn("[PixiArena] Hero idle textures failed to load, using fallback");
        const fb = createFallbackSprite(28, 28, "DEFENDER", DEFENDER_COLOR);
        fb.x = defX;
        fb.y = defY;
        defenderLayer.addChild(fb);
      }

      /* ---- Enemies ---- */
      enemyAnimRefs.current.clear();
      enemyContainerRefs.current.clear();
      enemyOriginRefs.current.clear();
      fallbackEnemies.current.clear();

      for (let i = 0; i < Math.min(combatants.length, ENEMY_POSITIONS.length); i++) {
        const atk = combatants[i];
        const pos = ENEMY_POSITIONS[i];
        const ex = w * pos.x;
        const ey = h * pos.y;
        const etype = atk.category;
        const isBoss = etype === "multi_turn_escalation";
        const scale = isBoss ? 1.6 : 1.3;
        const eColor = ENEMY_COLORS[etype] ?? 0xff5c7a;

        const hasTex = (enemyTexRef.current[etype]?.idle?.length ?? 0) > 0;
        if (hasTex) {
          const eAnim = makeAnimatedSprite(
            enemyTexRef.current[etype] ?? {},
            "idle",
            scale,
            eColor,
            etype.slice(0, 4).toUpperCase(),
            true,
          );
          eAnim.sprite.x = ex;
          eAnim.sprite.y = ey;
          enemyLayer.addChild(eAnim.sprite);
          enemyAnimRefs.current.set(atk.id, eAnim);
          enemyOriginRefs.current.set(atk.id, { x: ex, y: ey });
        } else {
          console.warn(`[PixiArena] Enemy ${etype} idle textures failed to load, using fallback`);
          const fb = createFallbackSprite(32, 32, etype.slice(0, 3).toUpperCase(), eColor);
          fb.x = ex;
          fb.y = ey;
          enemyLayer.addChild(fb);
          fallbackEnemies.current.set(atk.id, fb);
        }
      }

      /* ---- HUD ---- */
      const hudScale = 1;
      const leftX = 18;
      const rightX = w - 20;

      const labelStyle: Partial<PIXI.TextStyle> = {
        fontFamily: "Inter, monospace",
        fontSize: 9 * hudScale,
        fill: "#D8E6F5",
        fontWeight: "bold",
      };
      const valueStyle: Partial<PIXI.TextStyle> = {
        fontFamily: "Inter, monospace",
        fontSize: 11 * hudScale,
        fill: "#FFFFFF",
        fontWeight: "bold",
      };

      const waveText = new PIXI.Text({
        text: `WAVE ${String(wave).padStart(2, "0")}`,
        style: { ...valueStyle, fill: "#22D3EE" } as PIXI.TextStyle,
      });
      waveText.x = leftX;
      waveText.y = 10;

      const attackText = new PIXI.Text({
        text: formatAttackCounter(
          currentAttackIndex,
          combatants.length,
          isWaveComplete ? "waveComplete" : "running",
        ),
        style: valueStyle as PIXI.TextStyle,
      });
      attackText.x = leftX;
      attackText.y = 26;

      const modeLabel = mode === "agent_hardening" ? "HARDEN" : "RL LAB";
      const modeText = new PIXI.Text({
        text: modeLabel,
        style: {
          ...valueStyle,
          fill: mode === "agent_hardening" ? "#A78BFA" : "#22D3EE",
          fontSize: 10 * hudScale,
        } as PIXI.TextStyle,
      });
      modeText.x = leftX;
      modeText.y = 42;

      /* Right-side HUD */
      const barW = 82;

      const integrityBarBg = new PIXI.Graphics();
      integrityBarBg.rect(0, 0, barW, 6).fill({ color: 0x1a1a2e });
      integrityBarBg.x = rightX - barW;
      integrityBarBg.y = 10;

      const integrityBarFill = new PIXI.Graphics();
      integrityBarFill.rect(0, 0, barW * (integrity / 100), 6).fill({ color: 0x4ade80 });
      integrityBarFill.x = rightX - barW;
      integrityBarFill.y = 10;

      const integrityLabel = new PIXI.Text({ text: `${integrity}%`, style: { ...valueStyle, fill: "#4ADE80", fontSize: 10 * hudScale } as PIXI.TextStyle });
      integrityLabel.x = rightX;
      integrityLabel.y = 9;
      integrityLabel.anchor.set(1, 0);

      const shieldBarBg = new PIXI.Graphics();
      shieldBarBg.rect(0, 0, barW, 6).fill({ color: 0x1a1a2e });
      shieldBarBg.x = rightX - barW;
      shieldBarBg.y = 22;

      const shieldBarFill = new PIXI.Graphics();
      shieldBarFill.rect(0, 0, barW * (shield / 100), 6).fill({ color: 0x22d3ee });
      shieldBarFill.x = rightX - barW;
      shieldBarFill.y = 22;

      const shieldLabel = new PIXI.Text({ text: `${shield}%`, style: { ...valueStyle, fill: "#22D3EE", fontSize: 10 * hudScale } as PIXI.TextStyle });
      shieldLabel.x = rightX;
      shieldLabel.y = 21;
      shieldLabel.anchor.set(1, 0);

      const scoreText = new PIXI.Text({
        text: `SCORE ${score}`,
        style: { ...valueStyle, fill: "#FBBF24", fontSize: 12 * hudScale } as PIXI.TextStyle,
      });
      scoreText.x = rightX;
      scoreText.y = 34;
      scoreText.anchor.set(1, 0);

      hudLayer.addChild(waveText, attackText, modeText);
      hudLayer.addChild(integrityBarBg, integrityBarFill, integrityLabel);
      hudLayer.addChild(shieldBarBg, shieldBarFill, shieldLabel);
      hudLayer.addChild(scoreText);

      hudRefs.current = {
        waveText,
        attackText,
        modeText,
        integrityLabel,
        shieldLabel,
        integrityBarBg,
        integrityBarFill,
        shieldBarBg,
        shieldBarFill,
        scoreText,
        narrationBg: null as unknown as PIXI.Graphics,
        narrationText: null as unknown as PIXI.Text,
      };

      /* ---- Narration bar ---- */
      const nBarW = Math.min(w * 0.55, 560);
      const nBarH = 36;
      const nBarX = w / 2;
      const nBarY = h - 34;

      const narrationBg = new PIXI.Graphics();
      narrationBg.rect(-nBarW / 2, -nBarH / 2, nBarW, nBarH).fill({ color: 0x080c13, alpha: 0.85 });
      narrationBg.rect(-nBarW / 2, -nBarH / 2, nBarW, nBarH).stroke({ width: 1, color: 0x6e82a0, alpha: 0.12 });
      narrationBg.x = nBarX;
      narrationBg.y = nBarY;
      narrationBg.visible = false;

      const narrationText = new PIXI.Text({
        text: "",
        style: {
          fontFamily: "Inter, monospace",
          fontSize: 12,
          fill: "#E8EDF4",
          wordWrap: true,
          wordWrapWidth: nBarW - 16,
          align: "center",
        },
      });
      narrationText.anchor.set(0.5);
      narrationText.x = nBarX;
      narrationText.y = nBarY;

      narrationLayer.addChild(narrationBg);
      narrationLayer.addChild(narrationText);

      hudRefs.current.narrationBg = narrationBg;
      hudRefs.current.narrationText = narrationText;

      /* ---- Projectile container (hidden initially) ---- */
      const projContainer = new PIXI.Container();
      projContainer.visible = false;
      effectLayer.addChild(projContainer);
      projectileRef.current = projContainer;

      const projTexs = effectTexRef.current.projectile ?? [];
      let projSprite: PIXI.Sprite;
      if (projTexs.length > 0) {
        projSprite = new PIXI.Sprite(projTexs[0]);
      } else {
        const fb = createFallbackSprite(12, 12, "", 0xf87171);
        projContainer.addChild(fb);
        projSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      }
      projSprite.anchor.set(0.5);
      projSprite.scale.set(0.8);
      projContainer.addChild(projSprite);
      projectileSpriteRef.current = projSprite;

      setTexturesReady(true);

      /* ---- Ticker ---- */
      let lastTickTime = performance.now();

      app.ticker.add(() => {
        if (destroyed) return;
        const now = performance.now();
        const dt = now - lastTickTime;
        lastTickTime = now;
        tick(dt);
      });
    })();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      setTexturesReady(false);
      initGuardRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================================================================ */
  /*  ENEMY SPRITE SYNC                                               */
  /* ================================================================ */
  useEffect(() => {
    if (!texturesReady) return;

    const combatantIds = combatants.map((atk) => atk.id).join("|");
    if (combatantIds === prevCombatantIdsRef.current) return;

    prevCombatantIdsRef.current = combatantIds;
    rebuildEnemySprites(combatants);

    if (combatants.length === 0) {
      prevAtkIdxRef.current = -1;
      combatRef.current.active = false;
      combatRef.current.phase = "idle";
    }
  }, [combatants, texturesReady]);

  /* ================================================================ */
  /*  COMBAT TRIGGER — when currentAttackIndex changes                */
  /* ================================================================ */
  useEffect(() => {
    const speed = speedRef.current;
    if (speed <= 0) return;
    if (currentAttackIndex < 0 || currentAttackIndex >= combatants.length) return;
    if (currentAttackIndex === prevAtkIdxRef.current) return;

    if (combatRef.current.active && combatRef.current.attackId) {
      resetEnemyToOrigin(combatRef.current.attackId);
      projContainerCleanup();
    }

    prevAtkIdxRef.current = currentAttackIndex;

    const atk = combatants[currentAttackIndex];
    if (!atk) return;

    const result = inferCombatResult(atk);

    const idx = combatants.indexOf(atk);
    const pos = ENEMY_POSITIONS[Math.min(idx, ENEMY_POSITIONS.length - 1)];
    const { width: w, height: h } = dimsRef.current;
    const origin = enemyOriginRefs.current.get(atk.id);
    const originX = origin?.x ?? w * (pos?.x ?? 0.72);
    const originY = origin?.y ?? h * (pos?.y ?? 0.48);
    const targetX = Math.min(originX - 42, w * DEFENDER_X_RATIO + ENEMY_APPROACH_X_OFFSET);
    const targetY = h * DEFENDER_Y_RATIO;
    const defX = w * DEFENDER_X_RATIO;
    const defY = h * DEFENDER_Y_RATIO;

    combatRef.current = {
      active: true,
      phase: "enemy_select",
      phaseTimer: 0,
      phaseDuration: PHASE_DURATIONS.enemy_select / speed,
      attackIndex: currentAttackIndex,
      attackId: atk.id,
      attackerType: atk.category,
      result,
      originX,
      originY,
      targetX,
      targetY,
      projFromX: originX,
      projFromY: originY,
      projToX: defX,
      projToY: defY,
    };

    /* Show narration */
    const nar = hudRefs.current?.narrationText;
    if (nar) {
      nar.text = `${atk.label} attacks with ${atk.category.replace(/_/g, " ")}!`;
      nar.alpha = 1;
    }
    const narBg = hudRefs.current?.narrationBg;
    if (narBg) narBg.visible = true;
  }, [currentAttackIndex, combatants]);

  /* ================================================================ */
  /*  DEFENDER STATE CHANGE                                           */
  /* ================================================================ */
  useEffect(() => {
    const mapped = mapDefenderState(defenderState);
    const anim = defenderAnimRef.current;
    if (anim && mapped !== prevDefStateRef.current) {
      prevDefStateRef.current = mapped;
      switchAnim(anim, mapped);
      if (mapped === "patch") {
        spawnPatchEffect();
      }
      if (mapped === "victory") {
        spawnLevelUpEffect();
      }
    }
  }, [defenderState]);

  /* ================================================================ */
  /*  HUD UPDATE                                                      */
  /* ================================================================ */
  useEffect(() => {
    const hud = hudRefs.current;
    if (!hud) return;

    const { width: w, height: h } = dimsRef.current;
    const barW = 82;
    const rightX = w - 20;

    hud.waveText.text = `WAVE ${String(wave).padStart(2, "0")}`;
    hud.attackText.text = formatAttackCounter(
      currentAttackIndex,
      combatants.length,
      isWaveComplete ? "waveComplete" : "running",
    );
    hud.modeText.text = mode === "agent_hardening" ? "HARDEN" : "RL LAB";
    hud.modeText.style.fill = mode === "agent_hardening" ? "#A78BFA" : "#22D3EE";

    const intColor = integrity > 70 ? 0x4ade80 : integrity > 35 ? 0xfbbf24 : 0xf87171;
    hud.integrityBarFill.clear();
    hud.integrityBarFill.rect(0, 0, barW * (integrity / 100), 6).fill({ color: intColor });
    hud.integrityBarFill.x = rightX - barW;

    hud.shieldBarFill.clear();
    hud.shieldBarFill.rect(0, 0, barW * (shield / 100), 6).fill({ color: 0x22d3ee });
    hud.shieldBarFill.x = rightX - barW;

    hud.scoreText.text = `SCORE ${score}`;

    /* Update value labels using stored refs */
    const icStr = integrity > 70 ? "#4ADE80" : integrity > 35 ? "#FBBF24" : "#F87171";
    hud.integrityLabel.text = `${integrity}%`;
    hud.integrityLabel.style.fill = icStr;
    hud.shieldLabel.text = `${shield}%`;
  }, [integrity, shield, score, wave, currentAttackIndex, combatants.length, mode, isWaveComplete]);

  /* ================================================================ */
  /*  NARRATION UPDATE                                                */
  /* ================================================================ */
  useEffect(() => {
    if (!narration) return;
    const narText = hudRefs.current?.narrationText;
    const narBg = hudRefs.current?.narrationBg;
    if (narText) {
      narText.text = narration;
      narText.alpha = 1;
    }
    if (narBg) narBg.visible = true;
  }, [narration]);

  /* ================================================================ */
  /*  WAVE COMPLETE                                                   */
  /* ================================================================ */
  useEffect(() => {
    if (isWaveComplete && !waveCompleteFiredRef.current) {
      waveCompleteFiredRef.current = true;
      const cb = onWaveCompleteRef.current;
      if (cb) cb();
    }
    if (!isWaveComplete) {
      waveCompleteFiredRef.current = false;
    }
  }, [isWaveComplete]);

  /* ================================================================ */
  /*  TICK                                                             */
  /* ================================================================ */
  function tick(dt: number): void {
    const speed = speedRef.current;
    if (speed <= 0) return;
    const { width: w, height: h } = dimsRef.current;

    /* ---- Update bob timer ---- */
    bobTimerRef.current += dt * BOB_SPEED;

    /* ---- Update combat sequence ---- */
    updateCombat(dt, w, h);

    /* ---- Update defender animation ---- */
    const defAnim = defenderAnimRef.current;
    if (defAnim) {
      tickAnimation(defAnim, dt);
      /* Y-bob when idle */
      if (defAnim.currentAnim === "idle") {
        defAnim.sprite.y = h * DEFENDER_Y_RATIO + Math.sin(bobTimerRef.current) * BOB_AMPLITUDE;
      }
    }

    /* ---- Update enemy animations ---- */
    for (const [, eAnim] of enemyAnimRefs.current) {
      tickAnimation(eAnim, dt);
    }

    /* ---- Update idle enemy bob ---- */
    for (const [id, origin] of enemyOriginRefs.current) {
      const eAnim = enemyAnimRefs.current.get(id);
      if (eAnim && eAnim.currentAnim === "idle") {
        eAnim.sprite.y = origin.y + Math.sin(bobTimerRef.current + id.length) * BOB_AMPLITUDE;
      }
    }

    /* ---- Update effects ---- */
    updateEffects(dt);
  }

  /* ================================================================ */
  /*  Combat sequence logic                                           */
  /* ================================================================ */

  function transitionTo(phase: CombatPhaseName): void {
    const seq = combatRef.current;
    if (!seq.active) return;

    const speed = speedRef.current;
    const duration =
      phase === "complete"
        ? 0
        : (PHASE_DURATIONS[phase] ?? 300) / speed;

    seq.phase = phase;
    seq.phaseTimer = 0;
    seq.phaseDuration = duration;
  }

  function updateCombat(dt: number, w: number, h: number): void {
    const seq = combatRef.current;
    if (!seq.active || seq.phase === "idle" || seq.phase === "complete") {
      return;
    }

    seq.phaseTimer += dt;
    const progress = Math.min(seq.phaseTimer / seq.phaseDuration, 1);
    const defX = w * DEFENDER_X_RATIO;
    const defY = h * DEFENDER_Y_RATIO;

    const eAnim = enemyAnimRefs.current.get(seq.attackId);

    switch (seq.phase) {
      case "enemy_select": {
        /* Scale bump and highlight */
        if (eAnim) {
          const bump = 1 + 0.15 * easeOutQuad(progress);
          eAnim.sprite.scale.set(eAnim.flipX ? -eAnim.baseScale * bump : eAnim.baseScale * bump, eAnim.baseScale * bump);
          eAnim.sprite.alpha = 0.8 + 0.2 * easeOutQuad(progress);
        }
        /* Enemy state to idle still, just highlighted */
        if (progress >= 1) {
          transitionTo("enemy_approach");
        }
        break;
      }

      case "enemy_approach": {
        /* Tween enemy toward defender */
        if (eAnim) {
          const t = easeInOutQuad(progress);
          const ox = seq.originX;
          const oy = seq.originY;
          eAnim.sprite.x = lerp(ox, seq.targetX, t);
          eAnim.sprite.y = lerp(oy, seq.targetY, t * 0.3);
          switchAnim(eAnim, "approach");
        }
        if (progress >= 1) {
          transitionTo("enemy_windup");
        }
        break;
      }

      case "enemy_windup": {
        /* Enemy plays attack windup animation */
        if (eAnim) {
          switchAnim(eAnim, "attack");
        }
        if (progress >= 1) {
          transitionTo("projectile_travel");
          /* Spawn projectile */
          spawnProjectile(seq);
        }
        break;
      }

      case "projectile_travel": {
        /* Projectile lerps from enemy to defender */
        const proj = projectileRef.current;
        const projSpr = projectileSpriteRef.current;
        if (proj) {
          proj.visible = true;
          const t = easeOutQuad(progress);
          proj.x = lerp(seq.projFromX, seq.projToX, t);
          proj.y = lerp(seq.projFromY, seq.projToY, t);
          /* Slight wobble */
          proj.x += Math.sin(progress * 20) * 2;
        }
        if (projSpr) {
          /* Animate projectile frames */
          const pTexs = effectTexRef.current.projectile ?? [];
          if (pTexs.length > 0) {
            const pIdx = Math.floor(progress * pTexs.length) % pTexs.length;
            projSpr.texture = pTexs[pIdx];
          }
        }
        if (progress >= 1) {
          projContainerCleanup();
          transitionTo("block_damage");
          spawnDefenderEffect(seq);
        }
        break;
      }

      case "block_damage": {
        /* Effect is playing independently on effect layer */
        if (progress >= 1) {
          transitionTo("defender_react");
        }
        break;
      }

      case "defender_react": {
        /* Defender plays reaction animation */
        const defAnim = defenderAnimRef.current;
        if (defAnim) {
          const animName = seq.result === "blocked" ? "defend" : "damaged";
          switchAnim(defAnim, animName);
        }
        if (progress >= 1) {
          transitionTo("enemy_recover");
        }
        break;
      }

      case "enemy_recover": {
        if (eAnim) {
          const t = easeInOutQuad(progress);
          eAnim.sprite.x = lerp(seq.targetX, seq.originX, t);
          eAnim.sprite.y = lerp(seq.targetY, seq.originY, t);
          if (progress < 0.5) {
            switchAnim(eAnim, seq.result === "blocked" ? "hit" : "approach");
          } else {
            switchAnim(eAnim, "idle");
          }
          /* Face away from defender while retreating */
          eAnim.sprite.scale.set(eAnim.baseScale, eAnim.baseScale);
          eAnim.sprite.alpha = 1;
        }

        if (progress >= 1) {
          /* Reset enemy — flip back to face defender */
          if (eAnim) {
            resetEnemyToOrigin(seq.attackId, enemyStates[seq.attackId] === "defeated" ? "defeated" : "idle");
            if (enemyStates[seq.attackId] === "defeated") {
              spawnSmokeEffect(seq.originX, seq.originY);
            }
          }
          /* Fire callback */
          seq.active = false;
          seq.phase = "complete";
          const cb = onAttackResolvedRef.current;
          if (cb) cb(seq.attackId, seq.result);

          /* Hide narration after delay */
          const narText = hudRefs.current?.narrationText;
          if (narText) {
            setTimeout(() => {
              if (narText.alpha > 0) {
                narText.alpha = 0;
              }
              const narBg = hudRefs.current?.narrationBg;
              if (narBg) narBg.visible = false;
            }, 2000);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  /* ================================================================ */
  /*  Projectile management                                           */
  /* ================================================================ */

  function spawnProjectile(seq: CombatSequence): void {
    const proj = projectileRef.current;
    const projSpr = projectileSpriteRef.current;
    if (proj) {
      proj.x = seq.projFromX;
      proj.y = seq.projFromY;
      proj.visible = true;
    }
    if (projSpr) {
      const pTexs = effectTexRef.current.projectile ?? [];
      if (pTexs.length > 0) {
        projSpr.texture = pTexs[0];
      }
    }
  }

  function projContainerCleanup(): void {
    const proj = projectileRef.current;
    if (proj) {
      proj.visible = false;
    }
  }

  /* ================================================================ */
  /*  Effect management                                               */
  /* ================================================================ */

  function spawnDefenderEffect(seq: CombatSequence): void {
    const { width: w, height: h } = dimsRef.current;
    const defX = w * DEFENDER_X_RATIO;
    const defY = h * DEFENDER_Y_RATIO;

    const effectKey = seq.result === "blocked" ? "shield_burst" : "hit_spark";
    const texs = effectTexRef.current[effectKey] ?? [];
    const eLayer = effectLayerRef.current;
    if (!eLayer) return;

    if (texs.length === 0) {
      /* Fallback effect: flash circle */
      const fb = new PIXI.Graphics();
      fb.circle(0, 0, 20).fill({
        color: seq.result === "blocked" ? 0x22d3ee : 0xf87171,
        alpha: 0.6,
      });
      fb.x = defX;
      fb.y = defY;
      eLayer.addChild(fb);
      effectRefs.current.push({
        container: new PIXI.Container(),
        sprite: new PIXI.Sprite(PIXI.Texture.EMPTY),
        textures: [],
        frameIndex: 0,
        frameTimer: 0,
        frameTime: 80,
        x: defX,
        y: defY,
        life: 500,
        done: false,
      });
      /* Remove fallback graphics after duration */
      const fbId = setTimeout(() => {
        if (fb.parent) fb.parent.removeChild(fb);
        fb.destroy();
      }, 500);
      return;
    }

    const spr = new PIXI.Sprite(texs[0]);
    spr.anchor.set(0.5);
    spr.scale.set(1.2);
    spr.x = defX;
    spr.y = defY;

    const effCont = new PIXI.Container();
    effCont.addChild(spr);
    eLayer.addChild(effCont);

    const frameTime = 80;
    effectRefs.current.push({
      container: effCont,
      sprite: spr,
      textures: texs,
      frameIndex: 0,
      frameTimer: 0,
      frameTime,
      x: defX,
      y: defY,
      life: texs.length * frameTime,
      done: false,
    });
  }

  function spawnSmokeEffect(x: number, y: number): void {
    const texs = effectTexRef.current.smoke ?? [];
    const eLayer = effectLayerRef.current;
    if (!eLayer) return;

    if (texs.length === 0) return;

    const spr = new PIXI.Sprite(texs[0]);
    spr.anchor.set(0.5);
    spr.scale.set(0.8);
    spr.x = x;
    spr.y = y;

    const effCont = new PIXI.Container();
    effCont.addChild(spr);
    eLayer.addChild(effCont);

    const frameTime = 120;
    effectRefs.current.push({
      container: effCont,
      sprite: spr,
      textures: texs,
      frameIndex: 0,
      frameTimer: 0,
      frameTime,
      x,
      y,
      life: texs.length * frameTime,
      done: false,
    });
  }

  function spawnPatchEffect(): void {
    const { width: w, height: h } = dimsRef.current;
    const defX = w * DEFENDER_X_RATIO;
    const defY = h * DEFENDER_Y_RATIO;
    const texs = effectTexRef.current.patch_beam ?? [];
    const eLayer = effectLayerRef.current;
    if (!eLayer) return;

    if (texs.length === 0) {
      const fb = new PIXI.Graphics();
      fb.rect(-3, -60, 6, 60).fill({ color: 0xa78bfa, alpha: 0.7 });
      fb.x = defX;
      fb.y = defY;
      eLayer.addChild(fb);
      setTimeout(() => {
        if (fb.parent) fb.parent.removeChild(fb);
        fb.destroy();
      }, 1200);
      return;
    }

    const spr = new PIXI.Sprite(texs[0]);
    spr.anchor.set(0.5, 1);
    spr.scale.set(1);
    spr.x = defX;
    spr.y = defY;

    const effCont = new PIXI.Container();
    effCont.addChild(spr);
    eLayer.addChild(effCont);

    const frameTime = 100;
    effectRefs.current.push({
      container: effCont,
      sprite: spr,
      textures: texs,
      frameIndex: 0,
      frameTimer: 0,
      frameTime,
      x: defX,
      y: defY,
      life: texs.length * frameTime,
      done: false,
    });
  }

  function spawnLevelUpEffect(): void {
    const { width: w, height: h } = dimsRef.current;
    const defX = w * DEFENDER_X_RATIO;
    const defY = h * DEFENDER_Y_RATIO;
    const texs = effectTexRef.current.level_up ?? [];
    const eLayer = effectLayerRef.current;
    if (!eLayer) return;

    if (texs.length === 0) {
      for (let i = 0; i < 8; i++) {
        const p = new PIXI.Graphics();
        p.circle(0, 0, 3).fill({ color: [0xa78bfa, 0x22d3ee, 0xfbbf24][i % 3], alpha: 0.8 });
        const angle = (Math.PI * 2 * i) / 8;
        p.x = defX + Math.cos(angle) * 30;
        p.y = defY + Math.sin(angle) * 30;
        eLayer.addChild(p);
      }
      return;
    }

    const spr = new PIXI.Sprite(texs[0]);
    spr.anchor.set(0.5);
    spr.scale.set(1.2);
    spr.x = defX;
    spr.y = defY;

    const effCont = new PIXI.Container();
    effCont.addChild(spr);
    eLayer.addChild(effCont);

    const frameTime = 100;
    effectRefs.current.push({
      container: effCont,
      sprite: spr,
      textures: texs,
      frameIndex: 0,
      frameTimer: 0,
      frameTime,
      x: defX,
      y: defY,
      life: texs.length * frameTime,
      done: false,
    });
  }

  function spawnWarningEffect(): void {
    const { width: w } = dimsRef.current;
    const texs = effectTexRef.current.warning ?? [];
    const eLayer = effectLayerRef.current;
    if (!eLayer) return;

    if (texs.length === 0) return;

    const spr = new PIXI.Sprite(texs[0]);
    spr.anchor.set(0.5);
    spr.scale.set(1.5);
    spr.x = w / 2;
    spr.y = 30;

    const effCont = new PIXI.Container();
    effCont.addChild(spr);
    eLayer.addChild(effCont);

    const frameTime = 150;
    effectRefs.current.push({
      container: effCont,
      sprite: spr,
      textures: texs,
      frameIndex: 0,
      frameTimer: 0,
      frameTime,
      x: w / 2,
      y: 30,
      life: texs.length * frameTime,
      done: false,
    });
  }

  function updateEffects(dt: number): void {
    const toRemove: number[] = [];
    const eLayer = effectLayerRef.current;

    for (let i = 0; i < effectRefs.current.length; i++) {
      const eff = effectRefs.current[i];
      if (eff.done) {
        toRemove.push(i);
        continue;
      }

      eff.life -= dt;
      if (eff.life <= 0) {
        eff.done = true;
        if (eff.container.parent) {
          eff.container.parent.removeChild(eff.container);
          eff.container.destroy({ children: true });
        }
        toRemove.push(i);
        continue;
      }

      /* Advance frames */
      if (eff.textures.length > 1) {
        eff.frameTimer += dt;
        if (eff.frameTimer >= eff.frameTime) {
          eff.frameTimer -= eff.frameTime;
          eff.frameIndex++;
          if (eff.frameIndex >= eff.textures.length) {
            eff.frameIndex = eff.textures.length - 1;
          }
          eff.sprite.texture = eff.textures[eff.frameIndex];
        }
      }
    }

    /* Cleanup from end to preserve indices */
    for (let i = toRemove.length - 1; i >= 0; i--) {
      effectRefs.current.splice(toRemove[i], 1);
    }
  }

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    />
  );
}
