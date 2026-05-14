
import { useState, useEffect, useRef } from "react";
import type { BattleState, AttackCategory } from "@/types/agentforge";

/*
 * Sprite atlas integration -- SpriteSheetRenderer provides animated
 * pixel-art sprites from the sprite sheets in /public/assets/agentforge/sprites/.
 * If the atlas module or its assets are unavailable, BattleSprite serves
 * as the CSS-rendered fallback.
 */
import {
  SpriteSheetRenderer,
  ASSET_PATHS,
  DEFENDER_ANIMS,
  ENEMY_ANIMS,
} from "@/lib/spriteAtlas";
import type {
  DefenderAnimState,
  EnemyAnimState as AtlasEnemyAnimState,
  EnemyType,
  SpriteAnimation,
} from "@/lib/spriteAtlas";
import BattleEffectsLayer from "./BattleEffectsLayer";
import ArenaNarrationBar from "./ArenaNarrationBar";
import BattleSprite from "./BattleSprite";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface LiveArenaPanelProps {
  state: BattleState;
  narration: string;
}

/* ------------------------------------------------------------------ */
/*  Enemy staggered positions (right-side, percentage coords)         */
/* ------------------------------------------------------------------ */

const ENEMY_POSITIONS: Record<AttackCategory, { top: string; right: string }> =
  {
    prompt_injection: { top: "20%", right: "28%" },
    role_impersonation: { top: "35%", right: "16%" },
    emotional_manipulation: { top: "50%", right: "24%" },
    tool_abuse: { top: "28%", right: "6%" },
    policy_extraction: { top: "44%", right: "6%" },
    multi_turn_escalation: { top: "60%", right: "14%" },
  };

/* ------------------------------------------------------------------ */
/*  Animation state mapping from BattlePhase                          */
/* ------------------------------------------------------------------ */

function getDefenderAtlasAnim(
  status: BattleState["status"]
): DefenderAnimState {
  switch (status) {
    case "idle":
    case "running_wave":
    case "completed":
      return "idle";
    case "attack_blocked":
      return "defend";
    case "attack_failed":
      return "hit";
    case "patching":
      return "patch";
    case "upgraded":
      return "victory";
    case "collapsed":
      return "broken";
    default:
      return "idle";
  }
}

/** Convert atlas defender state to the legacy BattleSprite anim value. */
function defenderToLegacyFallback(
  atlas: DefenderAnimState
): "idle" | "hit" | "upgrading" | "defeated" {
  switch (atlas) {
    case "hit":
      return "hit";
    case "patch":
    case "victory":
      return "upgrading";
    case "broken":
      return "defeated";
    default:
      return "idle";
  }
}

function getEnemyAtlasAnim(
  status: BattleState["status"],
  isCurrentEnemy: boolean,
  legacyEnemyState: string
): AtlasEnemyAnimState {
  /* Global overrides */
  if (status === "idle" || status === "completed") return "idle";

  /* Current-enemy overrides per battle phase */
  if (isCurrentEnemy) {
    if (status === "running_wave") return "attack";
    if (status === "attack_blocked") return "hit";
    if (status === "attack_failed") return "attack";
  }

  /* Map the legacy EnemyAnimState to atlas states */
  switch (legacyEnemyState) {
    case "attacking":
      return "attack";
    case "blocked":
      return "hit";
    case "defeated":
      return "collapse";
    default:
      return "idle";
  }
}

/** Convert atlas enemy state to the legacy BattleSprite anim value. */
function enemyToLegacyFallback(
  atlas: string
): "idle" | "attacking" | "blocked" | "successful" | "defeated" {
  if (atlas === "attack") return "attacking";
  if (atlas === "hit") return "blocked";
  if (atlas === "collapse") return "defeated";
  return "idle";
}

/* ------------------------------------------------------------------ */
/*  LiveArenaPanel                                                    */
/* ------------------------------------------------------------------ */

export default function LiveArenaPanel({
  state,
  narration,
}: LiveArenaPanelProps) {
  /* ---- Atlas readiness: preload one sprite sheet to detect availability ---- */
  const [atlasReady, setAtlasReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setAtlasReady(true);
    img.onerror = () => setAtlasReady(false);
    img.src = ASSET_PATHS.defenderSheet;
  }, []);

  /* ---- Battle effects management (triggered by status changes) ---- */
  const prevStatusRef = useRef(state.status);
  const [currentEffects, setCurrentEffects] = useState<string[]>([]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = state.status;
    prevStatusRef.current = curr;

    if (prev === curr) return;

    let effects: string[] = [];
    switch (curr) {
      case "attack_failed":
        effects = ["damage"];
        break;
      case "attack_blocked":
        effects = ["shieldBurst"];
        break;
      case "patching":
        effects = ["patchBeam"];
        break;
      case "upgraded":
        effects = ["levelUp"];
        break;
    }

    if (effects.length > 0) {
      setCurrentEffects(effects);
      setTimeout(() => setCurrentEffects([]), 2000);
    }
  }, [state.status]);

  /* ---- Derived values ---- */
  const defenderAnim = getDefenderAtlasAnim(state.status);
  const activeGen = state.generations.find(
    (g) => g.id === state.activeGenerationId
  );
  const currentAttackIdx = state.currentAttackIndex;
  const effectPosition = { x: 22, y: 45 };

  return (
    <div
      className="flex-1 relative mx-3 overflow-hidden rounded-2xl"
      style={{ minHeight: "520px", background: "#0A0E17" }}
    >
      {/* ── Arena layers ── */}
      <ArenaBackground />

      {/* ── HUD overlays ── */}
      <ArenaHudLeft state={state} />
      <ArenaHudRight state={state} />

      {/* ── Defender ── */}
      <div
        className="flex flex-col items-center"
        style={{
          position: "absolute",
          left: "22%",
          top: "45%",
          transform: "translate(-50%, -50%)",
          zIndex: 5,
        }}
      >
        <SpriteUnit
          type="defender"
          atlasAnim={defenderAnim}
          size={92}
          label={
            activeGen
              ? `${activeGen.name} Lv.${activeGen.level}`
              : "RefundBot"
          }
          integrity={state.integrity}
          shield={state.shield}
          atlasReady={atlasReady}
        />
      </div>

      {/* ── Enemies ── */}
      {state.attacks.slice(0, 6).map((atk) => {
        const pos = ENEMY_POSITIONS[atk.category];
        if (!pos) return null;

        const isCurrent =
          atk.id === state.attacks[currentAttackIdx]?.id;
        const enemyAnim = getEnemyAtlasAnim(
          state.status,
          isCurrent,
          atk.enemyState
        );

        return (
          <div
            key={atk.id}
            className={enemyAnim === "attack" ? "animate-slide-left" : ""}
            style={{
              position: "absolute",
              top: pos.top,
              right: pos.right,
              zIndex: 5,
            }}
          >
            <SpriteUnit
              type={atk.category}
              atlasAnim={enemyAnim}
              size={54}
              label={atk.label}
              atlasReady={atlasReady}
            />
          </div>
        );
      })}

      {/* ── Battle effects ── */}
      <BattleEffectsLayer
        activeEffects={currentEffects}
        position={effectPosition}
      />

      {/* ── Narration bar ── */}
      <ArenaNarrationBar text={narration} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ArenaBackground -- layered background with grid + vignette        */
/* ------------------------------------------------------------------ */

function ArenaBackground() {
  return (
    <>
      {/* Base arena image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url('/assets/agentforge/references/arena_reference_lab.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Pixel grid overlay (32px increments) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(110,130,160,0.04) 31px, rgba(110,130,160,0.04) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(110,130,160,0.04) 31px, rgba(110,130,160,0.04) 32px)",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(10, 14, 23, 0.5) 100%)",
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  HUD chips                                                         */
/* ------------------------------------------------------------------ */

function HudChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="px-2.5 py-1 rounded-lg"
      style={{
        background: "rgba(0, 0, 0, 0.55)",
        border: "1px solid rgba(110, 130, 160, 0.12)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="text-[9px] uppercase tracking-wider leading-tight"
        style={{ color: "#5A6E86" }}
      >
        {label}
      </div>
      <div
        className="text-[11px] font-bold font-mono leading-tight"
        style={{ color: accent || "#E8EDF4" }}
      >
        {value}
      </div>
    </div>
  );
}

function ArenaHudLeft({ state }: { state: BattleState }) {
  return (
    <div
      className="absolute top-3 left-3 z-10 flex items-center gap-2"
      style={{ pointerEvents: "none" }}
    >
      <HudChip
        label="WAVE"
        value={String(state.currentWave).padStart(2, "0")}
        accent="#22D3EE"
      />
      <HudChip
        label="ATTACK"
        value={`${String(state.currentAttackIndex + 1).padStart(2, "0")}/${state.attacks.length}`}
      />
      <HudChip
        label="MODE"
        value={
          state.mode === "retest"
            ? "RETEST"
            : state.mode === "patched"
              ? "PATCHED"
              : "INITIAL"
        }
        accent={
          state.mode === "retest"
            ? "#A78BFA"
            : state.mode === "patched"
              ? "#22D3EE"
              : "#5A6E86"
        }
      />
    </div>
  );
}

function ArenaHudRight({ state }: { state: BattleState }) {
  return (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-2"
      style={{ pointerEvents: "none" }}
    >
      <HudChip
        label="INTEGRITY"
        value={`${state.integrity}%`}
        accent="#4ADE80"
      />
      <HudChip
        label="SHIELD"
        value={`${state.shield}%`}
        accent="#22D3EE"
      />
      <HudChip
        label="SCORE"
        value={String(state.score)}
        accent="#FBBF24"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SpriteUnit - atlas-aware sprite renderer with CSS fallback        */
/* ------------------------------------------------------------------ */

interface SpriteUnitProps {
  type: "defender" | AttackCategory;
  atlasAnim: string;
  size?: number;
  label?: string;
  integrity?: number;
  shield?: number;
  atlasReady: boolean;
}

function SpriteUnit({
  type,
  atlasAnim,
  size = 64,
  label,
  integrity,
  shield,
  atlasReady,
}: SpriteUnitProps) {
  if (atlasReady) {
    return (
      <AtlasSprite
        type={type}
        atlasAnim={atlasAnim}
        size={size}
        label={label}
        integrity={integrity}
        shield={shield}
      />
    );
  }

  /* ── CSS fallback (BattleSprite) ── */
  if (type === "defender") {
    const fallback = defenderToLegacyFallback(
      atlasAnim as DefenderAnimState
    );
    return (
      <BattleSprite
        type="defender"
        animState={fallback}
        size={size}
        label={label}
        integrity={integrity}
        shield={shield}
      />
    );
  }

  const fallback = enemyToLegacyFallback(atlasAnim);
  const isDefeated = atlasAnim === "collapse";

  return (
    <div
      style={{
        opacity: isDefeated ? 0.12 : 1,
        transition: "opacity 0.5s, transform 0.5s",
        transform: isDefeated ? "translateY(10px)" : "none",
        pointerEvents: "none",
      }}
    >
      {/* Flip enemy fallback sprites to face left toward defender */}
      <div style={{ transform: "scaleX(-1)" }}>
        <BattleSprite
          type={type as AttackCategory}
          animState={fallback}
          size={size}
          label={label}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AtlasSprite - renders using SpriteSheetRenderer + stat overlays   */
/* ------------------------------------------------------------------ */

interface AtlasSpriteProps {
  type: "defender" | AttackCategory;
  atlasAnim: string;
  size?: number;
  label?: string;
  integrity?: number;
  shield?: number;
}

function AtlasSprite({
  type,
  atlasAnim,
  size = 64,
  label,
  integrity,
  shield,
}: AtlasSpriteProps) {
  if (type === "defender") {
    const anim = DEFENDER_ANIMS[atlasAnim as DefenderAnimState];
    if (!anim) return null;

    const scale = size / (anim.frames[0]?.w || 64);
    const hpColor =
      (integrity ?? 100) > 70
        ? "#4ADE80"
        : (integrity ?? 100) > 35
          ? "#FBBF24"
          : "#F87171";

    return (
      <div className="flex flex-col items-center">
        {/* Integrity bar */}
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "#5A6E86" }}
          >
            INTEGRITY
          </span>
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: Math.round(72 * (scale || 1)),
              height: Math.round(6 * (scale || 1)),
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${integrity ?? 100}%`,
                background: hpColor,
              }}
            />
          </div>
          <span
            className="text-[9px] font-mono font-bold"
            style={{ color: hpColor }}
          >
            {integrity ?? 100}%
          </span>
        </div>

        {/* Label */}
        {label && (
          <div
            className="text-[10px] font-bold tracking-wide mb-1"
            style={{ color: "#E8EDF4" }}
          >
            {label}
          </div>
        )}

        {/* Sprite animation */}
        <SpriteSheetRenderer
          sheetUrl={ASSET_PATHS.defenderSheet}
          animation={anim}
          animKey={atlasAnim}
          scale={scale}
          className="pixel-render"
        />

        {/* Shield bar */}
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "#5A6E86" }}
          >
            SHIELD
          </span>
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: Math.round(56 * (scale || 1)),
              height: Math.round(4 * (scale || 1)),
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${shield ?? 0}%`, background: "#22D3EE" }}
            />
          </div>
        </div>

        {/* Status pill */}
        <div className="mt-1">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider"
            style={{
              background:
                atlasAnim === "broken"
                  ? "rgba(248,113,113,0.15)"
                  : atlasAnim === "victory" || atlasAnim === "patch"
                    ? "rgba(167,139,250,0.15)"
                    : "rgba(74,222,128,0.15)",
              color:
                atlasAnim === "broken"
                  ? "#F87171"
                  : atlasAnim === "victory" || atlasAnim === "patch"
                    ? "#A78BFA"
                    : "#4ADE80",
            }}
          >
            {atlasAnim === "broken"
              ? "Vulnerable"
              : atlasAnim === "victory" || atlasAnim === "patch"
                ? "Upgrading"
                : "Hardened"}
          </span>
        </div>
      </div>
    );
  }

  /* ── Enemy sprite ── */
  const enemyType = type as EnemyType;
  const enemyAnims = ENEMY_ANIMS[enemyType];
  if (!enemyAnims) return null;

  const anim = enemyAnims[atlasAnim as AtlasEnemyAnimState];
  if (!anim) return null;

  const scale = size / (anim.frames[0]?.w || 56);
  const isDefeated = atlasAnim === "collapse";

  return (
    <div
      className="flex flex-col items-center"
      style={{
        opacity: isDefeated ? 0.12 : 1,
        transition: "opacity 0.5s, transform 0.5s",
        transform: isDefeated ? "translateY(10px)" : "none",
        pointerEvents: "none",
      }}
    >
      <SpriteSheetRenderer
        sheetUrl={
          enemyType === "multi_turn_escalation"
            ? ASSET_PATHS.enemyBoss
            : ASSET_PATHS.enemySheet
        }
        animation={anim}
        animKey={atlasAnim}
        scale={scale}
        flipX
        className="pixel-render"
      />

      {/* Label */}
      {label && (
        <span
          className="text-[9px] mt-1 text-center leading-tight max-w-[60px]"
          style={{ color: "#8FA0B8" }}
        >
          {label}
        </span>
      )}

      {/* Status indicators */}
      <div className="mt-0.5 flex items-center gap-1">
        {atlasAnim === "hit" && (
          <span
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: "#22D3EE" }}
          >
            BLOCKED
          </span>
        )}
        {atlasAnim === "idle" && (
          <span
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: "#4ADE80" }}
          >
            BREACH
          </span>
        )}
        {atlasAnim === "collapse" && (
          <span
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: "#F87171" }}
          >
            DOWN
          </span>
        )}
      </div>
    </div>
  );
}
