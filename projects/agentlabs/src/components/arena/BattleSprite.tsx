
import type { AttackCategory, EnemyAnimState } from "@/types/agentforge";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type SpriteType = "defender" | AttackCategory;

type SpriteAnimState =
  | "idle"
  | "hit"
  | "upgrading"
  | "defeated"
  | EnemyAnimState;

interface BattleSpriteProps {
  type: SpriteType;
  animState: SpriteAnimState;
  size?: number;
  label?: string;
  integrity?: number;
  shield?: number;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                       */
/* ------------------------------------------------------------------ */

const ENEMY_CONFIG: Record<
  AttackCategory,
  { body: string; accent: string; dark: string; label: string }
> = {
  prompt_injection: {
    body: "#FF5C7A",
    accent: "#FF8FA8",
    dark: "#B91C1C",
    label: "Injection",
  },
  role_impersonation: {
    body: "#A78BFA",
    accent: "#C4B5FD",
    dark: "#5B21B6",
    label: "Impersonation",
  },
  emotional_manipulation: {
    body: "#F97316",
    accent: "#FDBA74",
    dark: "#9A3412",
    label: "Emotional",
  },
  tool_abuse: {
    body: "#EAB308",
    accent: "#FDE047",
    dark: "#854D0E",
    label: "Tool Abuse",
  },
  policy_extraction: {
    body: "#22D3EE",
    accent: "#67E8F9",
    dark: "#0E7490",
    label: "Extraction",
  },
  multi_turn_escalation: {
    body: "#EF4444",
    accent: "#F87171",
    dark: "#991B1B",
    label: "Escalation",
  },
};

export default function BattleSprite({
  type,
  animState,
  size = 64,
  label,
  integrity,
  shield,
}: BattleSpriteProps) {
  if (type === "defender") {
    return (
      <RaccoonDefender
        animState={animState as "idle" | "hit" | "upgrading" | "defeated"}
        size={size}
        label={label}
        integrity={integrity}
        shield={shield}
      />
    );
  }

  const config = ENEMY_CONFIG[type] || ENEMY_CONFIG.prompt_injection;

  return (
    <EnemySprite
      category={type}
      animState={animState as EnemyAnimState}
      size={size}
      label={label}
      config={config}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Raccoon Defender -- CSS pixel-art character                       */
/* ------------------------------------------------------------------ */

function RaccoonDefender({
  animState,
  size,
  label,
  integrity = 100,
  shield = 0,
}: {
  animState: "idle" | "hit" | "upgrading" | "defeated";
  size: number;
  label?: string;
  integrity?: number;
  shield?: number;
}) {
  const isIdle = animState === "idle";
  const isHit = animState === "hit";
  const isUpgrading = animState === "upgrading";
  const isDefeated = animState === "defeated";

  const scaleFactor = size / 88;
  const s = (n: number) => Math.round(n * scaleFactor);

  const hpColor =
    integrity > 70
      ? "#4ADE80"
      : integrity > 35
        ? "#FBBF24"
        : "#F87171";

  return (
    <div
      className="flex flex-col items-center"
      style={{ position: "absolute", left: "25%", top: "45%" }}
    >
      {/* Integrity bar */}
      <div
        className="mb-1 flex items-center gap-1.5"
        style={{ transform: `scale(${scaleFactor})`, transformOrigin: "bottom center" }}
      >
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "#5A6E86" }}>
          INTEGRITY
        </span>
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: s(72),
            height: s(6),
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${integrity}%`, background: hpColor }}
          />
        </div>
        <span
          className="text-[9px] font-mono font-bold"
          style={{ color: hpColor }}
        >
          {integrity}%
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

      {/* Sprite body */}
      <div
        className={`relative ${isIdle ? "animate-bob" : ""} ${isHit ? "animate-shake" : ""}`}
        style={{
          width: s(88),
          height: s(88),
          opacity: isDefeated ? 0.3 : 1,
          transform: isDefeated ? "rotate(10deg)" : "none",
          transition: "opacity 0.6s, transform 0.6s",
          imageRendering: "pixelated",
        }}
      >
        <RaccoonPixels
          size={size}
          eyeColor={isHit ? "#F87171" : "#F4F7FB"}
          isHit={isHit}
          isUpgrading={isUpgrading}
        />

        {/* Shield ring */}
        {shield > 15 && (
          <div
            className="absolute rounded-full"
            style={{
              inset: s(-6),
              border: `${s(2)}px solid rgba(34, 211, 238, 0.25)`,
              boxShadow: `0 0 ${s(12)}px rgba(34, 211, 238, 0.1)`,
            }}
          />
        )}

        {/* Upgrade beam */}
        {isUpgrading && (
          <div
            className="absolute left-1/2 bottom-full animate-beam-up"
            style={{
              width: s(4),
              height: s(60),
              background: "linear-gradient(to top, #A78BFA, transparent)",
              transformOrigin: "bottom",
              marginLeft: s(-2),
            }}
          />
        )}

        {/* Upgrade glow */}
        {isUpgrading && (
          <div
            className="absolute rounded-full"
            style={{
              inset: s(-4),
              background: "radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)",
            }}
          />
        )}
      </div>

      {/* Shield bar */}
      <div
        className="mt-1 flex items-center gap-1.5"
        style={{ transform: `scale(${scaleFactor})`, transformOrigin: "top center" }}
      >
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "#5A6E86" }}>
          SHIELD
        </span>
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: s(56),
            height: s(4),
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${shield}%`, background: "#22D3EE" }}
          />
        </div>
      </div>

      {/* Status pill */}
      <div className="mt-1" style={{ transform: `scale(${scaleFactor})`, transformOrigin: "top center" }}>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider"
          style={{
            background: isDefeated
              ? "rgba(248,113,113,0.15)"
              : isUpgrading
                ? "rgba(167,139,250,0.15)"
                : "rgba(74,222,128,0.15)",
            color: isDefeated ? "#F87171" : isUpgrading ? "#A78BFA" : "#4ADE80",
          }}
        >
          {isDefeated ? "Vulnerable" : isUpgrading ? "Upgrading" : "Hardened"}
        </span>
      </div>
    </div>
  );
}

/* Raccoon pixel-art built with CSS boxes */
function RaccoonPixels({
  size,
  eyeColor,
  isHit,
  isUpgrading,
}: {
  size: number;
  eyeColor: string;
  isHit: boolean;
  isUpgrading: boolean;
}) {
  const s = size / 88;

  const px = (n: number) => Math.round(n * s);
  const py = (n: number) => Math.round(n * s);

  const styleAt = (left: number, top: number, width: number, height: number, extra: React.CSSProperties = {}) =>
    ({
      position: "absolute",
      left: px(left),
      top: py(top),
      width: px(width),
      height: py(height),
      ...extra,
    }) as React.CSSProperties;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Tail (behind body) */}
      <div
        style={styleAt(10, 42, 14, 10, {
          background: "#6B7280",
          borderRadius: px(4) + " " + px(2) + " " + px(6) + " " + px(2),
          opacity: 0.8,
        })}
      />

      {/* Legs */}
      <div
        style={styleAt(26, 64, 10, 14, {
          background: "#4B5563",
          borderRadius: "0 0 " + px(3) + " " + px(3),
        })}
      />
      <div
        style={styleAt(50, 64, 10, 14, {
          background: "#4B5563",
          borderRadius: "0 0 " + px(3) + " " + px(3),
        })}
      />

      {/* Body */}
      <div
        style={styleAt(22, 36, 42, 32, {
          background: "#6B7280",
          borderRadius: px(6) + " " + px(6) + " " + px(3) + " " + px(3),
          border: px(1) + " solid rgba(255,255,255,0.06)",
        })}
      />

      {/* Belly patch */}
      <div
        style={styleAt(30, 42, 26, 18, {
          background: "#9CA3AF",
          borderRadius: px(3),
          opacity: 0.4,
        })}
      />

      {/* Scarf */}
      <div
        style={styleAt(16, 32, 54, 9, {
          background: "#22D3EE",
          borderRadius: px(2),
          boxShadow: "0 0 " + px(6) + "px rgba(34,211,238,0.15)",
        })}
      />
      {/* Scarf tail */}
      <div
        style={styleAt(14, 34, 6, 8, {
          background: "#22D3EE",
          borderRadius: "0 0 " + px(2) + " " + px(2),
          opacity: 0.7,
        })}
      />

      {/* Head */}
      <div
        style={styleAt(18, 8, 50, 34, {
          background: "#7C8490",
          borderRadius: px(22) + " " + px(22) + " " + px(14) + " " + px(14),
          border: px(1) + " solid rgba(255,255,255,0.06)",
        })}
      />

      {/* Ears */}
      <div
        style={styleAt(18, 1, 14, 16, {
          background: "#5B626E",
          borderRadius: px(8) + " " + px(8) + " " + px(2) + " " + px(2),
          transform: "rotate(-8deg)",
        })}
      />
      <div
        style={styleAt(54, 1, 14, 16, {
          background: "#5B626E",
          borderRadius: px(8) + " " + px(8) + " " + px(2) + " " + px(2),
          transform: "rotate(8deg)",
        })}
      />
      {/* Inner ear */}
      <div
        style={styleAt(21, 4, 8, 8, {
          background: "#9CA3AF",
          borderRadius: px(6) + " " + px(6) + " " + px(1) + " " + px(1),
          opacity: 0.4,
          transform: "rotate(-8deg)",
        })}
      />
      <div
        style={styleAt(57, 4, 8, 8, {
          background: "#9CA3AF",
          borderRadius: px(6) + " " + px(6) + " " + px(1) + " " + px(1),
          opacity: 0.4,
          transform: "rotate(8deg)",
        })}
      />

      {/* Dark mask across eyes */}
      <div
        style={styleAt(20, 15, 46, 12, {
          background: "#374151",
          borderRadius: px(8),
          opacity: 0.6,
        })}
      />

      {/* Eyes */}
      <div
        style={styleAt(28, 17, 7, 7, {
          background: eyeColor,
          borderRadius: px(1),
          transition: "background 0.2s",
        })}
      />
      <div
        style={styleAt(51, 17, 7, 7, {
          background: eyeColor,
          borderRadius: px(1),
          transition: "background 0.2s",
        })}
      />

      {/* Pupils */}
      {!isHit && (
        <>
          <div
            style={styleAt(30, 19, 3, 4, {
              background: "#111827",
              borderRadius: px(1),
            })}
          />
          <div
            style={styleAt(53, 19, 3, 4, {
              background: "#111827",
              borderRadius: px(1),
            })}
          />
        </>
      )}

      {/* Nose */}
      <div
        style={styleAt(40, 26, 6, 4, {
          background: "#111827",
          borderRadius: px(3) + " " + px(3) + " " + px(1) + " " + px(1),
        })}
      />

      {/* Mouth */}
      <div
        style={styleAt(38, 30, 10, 3, {
          borderBottom: px(1) + " solid rgba(255,255,255,0.15)",
          borderRadius: "50%",
        })}
      />

      {/* Whiskers */}
      <div
        style={styleAt(10, 22, 10, 1, {
          background: "rgba(255,255,255,0.12)",
          borderRadius: px(1),
        })}
      />
      <div
        style={styleAt(10, 26, 8, 1, {
          background: "rgba(255,255,255,0.12)",
          borderRadius: px(1),
        })}
      />
      <div
        style={styleAt(68, 22, 10, 1, {
          background: "rgba(255,255,255,0.12)",
          borderRadius: px(1),
        })}
      />
      <div
        style={styleAt(70, 26, 8, 1, {
          background: "rgba(255,255,255,0.12)",
          borderRadius: px(1),
        })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enemy sprite container                                             */
/* ------------------------------------------------------------------ */

function EnemySprite({
  category,
  animState,
  size,
  label,
  config,
}: {
  category: AttackCategory;
  animState: EnemyAnimState;
  size: number;
  label?: string;
  config: { body: string; accent: string; dark: string; label: string };
}) {
  const isAttacking = animState === "attacking";
  const isBlocked = animState === "blocked";
  const isDefeated = animState === "defeated";
  const isSuccessful = animState === "successful";

  return (
    <div
      className={`flex flex-col items-center ${isAttacking ? "" : ""}`}
      style={{
        opacity: isDefeated ? 0.12 : 1,
        transition: "opacity 0.5s, transform 0.5s",
        transform: isDefeated ? "translateY(10px)" : "none",
        pointerEvents: "none",
      }}
    >
      {/* Sprite */}
      <div
        className={isAttacking ? "animate-slide-left" : ""}
        style={{ width: size, height: size }}
      >
        <EnemyPixels
          category={category}
          size={size}
          config={config}
          animState={animState}
        />
      </div>

      {/* Label */}
      {label && (
        <span
          className="text-[9px] mt-1 text-center leading-tight max-w-[60px]"
          style={{ color: "#8FA0B8" }}
        >
          {label}
        </span>
      )}

      {/* Status indicator */}
      <div className="mt-0.5 flex items-center gap-1">
        {isBlocked && (
          <span
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: "#22D3EE" }}
          >
            BLOCKED
          </span>
        )}
        {isSuccessful && (
          <span
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: "#4ADE80" }}
          >
            BREACH
          </span>
        )}
        {isDefeated && (
          <span
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: "#F87171" }}
          >
            DOWN
          </span>
        )}
      </div>

      {/* Blocked flash */}
      {isBlocked && (
        <div
          className="rounded-lg"
          style={{
            position: "absolute",
            inset: -3,
            border: "2px solid rgba(34, 211, 238, 0.4)",
            borderRadius: "6px",
            animation: "flash-blue 0.5s ease-out",
          }}
        />
      )}

      {/* Successful glow */}
      {isSuccessful && (
        <div
          className="rounded-lg"
          style={{
            position: "absolute",
            inset: -2,
            background: "radial-gradient(circle, rgba(74,222,128,0.1) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enemy pixel-art variants by attack category                        */
/* ------------------------------------------------------------------ */

function EnemyPixels({
  category,
  size,
  config,
  animState,
}: {
  category: AttackCategory;
  size: number;
  config: { body: string; accent: string; dark: string; label: string };
  animState: EnemyAnimState;
}) {
  const p = (n: number) => Math.round(n * (size / 52));

  const abs = (left: number, top: number, width: number, height: number, extra: React.CSSProperties = {}) =>
    ({
      position: "absolute",
      left: p(left),
      top: p(top),
      width: p(width),
      height: p(height),
      ...extra,
    }) as React.CSSProperties;

  const { body, accent, dark } = config;

  switch (category) {
    /* ----- INJECTION (glitchy fox) ----- */
    case "prompt_injection":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          {/* Ears */}
          <div style={abs(10, 4, 8, 14, { background: body, borderRadius: p(6) + " " + p(6) + " 0 0", transform: "rotate(-10deg)" })} />
          <div style={abs(32, 4, 8, 14, { background: body, borderRadius: p(6) + " " + p(6) + " 0 0", transform: "rotate(10deg)" })} />
          {/* Head */}
          <div style={abs(8, 12, 34, 24, { background: body, border: p(1.5) + " solid " + accent, borderRadius: p(4) + " " + p(4) + " " + p(8) + " " + p(8) })} />
          {/* Eyes */}
          <div style={abs(14, 18, 5, 5, { background: "#F4F7FB", borderRadius: p(1) })} />
          <div style={abs(31, 18, 5, 5, { background: "#F4F7FB", borderRadius: p(1) })} />
          {/* Pupils glitch */}
          <div style={abs(15, 20, 3, 3, { background: dark })} />
          <div style={abs(32, 20, 3, 3, { background: dark })} />
          {/* Mouth */}
          <div style={abs(18, 30, 12, 4, { background: accent, borderRadius: "50%", opacity: 0.5 })} />
          {/* Glitch lines */}
          <div style={abs(4, 14, 4, 2, { background: accent, opacity: 0.3 })} />
          <div style={abs(42, 28, 4, 2, { background: accent, opacity: 0.3 })} />
          {/* Body */}
          <div style={abs(12, 34, 26, 14, { background: body, borderRadius: p(2), opacity: 0.7 })} />
        </div>
      );

    /* ----- IMPERSONATION (masked cat) ----- */
    case "role_impersonation":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          {/* Pointed ears */}
          <div style={abs(8, 2, 10, 14, { background: body, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" })} />
          <div style={abs(32, 2, 10, 14, { background: body, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" })} />
          {/* Head */}
          <div style={abs(6, 10, 38, 28, { background: body, border: p(1.5) + " solid " + accent, borderRadius: p(14) + " " + p(14) + " " + p(8) + " " + p(8) })} />
          {/* Mask overlay */}
          <div style={abs(10, 18, 30, 10, { background: dark, borderRadius: p(6), opacity: 0.35 })} />
          {/* Eyes */}
          <div style={abs(14, 19, 6, 6, { background: "#F4F7FB", borderRadius: p(2) })} />
          <div style={abs(30, 19, 6, 6, { background: "#F4F7FB", borderRadius: p(2) })} />
          {/* Pupils */}
          <div style={abs(16, 20, 3, 5, { background: dark })} />
          <div style={abs(32, 20, 3, 5, { background: dark })} />
          {/* Whiskers */}
          <div style={abs(1, 20, 8, 1, { background: accent, opacity: 0.3 })} />
          <div style={abs(1, 24, 7, 1, { background: accent, opacity: 0.3 })} />
          <div style={abs(41, 20, 8, 1, { background: accent, opacity: 0.3 })} />
          <div style={abs(42, 24, 7, 1, { background: accent, opacity: 0.3 })} />
        </div>
      );

    /* ----- EMOTIONAL (rabbit with tear) ----- */
    case "emotional_manipulation":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          {/* Long ears */}
          <div style={abs(12, 0, 8, 20, { background: body, borderRadius: p(6) + " " + p(6) + " " + p(2) + " " + p(2) })} />
          <div style={abs(30, 2, 8, 18, { background: body, borderRadius: p(6) + " " + p(6) + " " + p(2) + " " + p(2) })} />
          {/* Inner ears */}
          <div style={abs(14, 3, 4, 12, { background: accent, borderRadius: p(4) + " " + p(4) + " " + p(1) + " " + p(1), opacity: 0.5 })} />
          <div style={abs(32, 5, 4, 10, { background: accent, borderRadius: p(4) + " " + p(4) + " " + p(1) + " " + p(1), opacity: 0.5 })} />
          {/* Head */}
          <div style={abs(8, 16, 34, 24, { background: body, border: p(1.5) + " solid " + accent, borderRadius: p(12) + " " + p(12) + " " + p(8) + " " + p(8) })} />
          {/* Eyes */}
          <div style={abs(14, 22, 6, 6, { background: "#F4F7FB", borderRadius: p(2) })} />
          <div style={abs(30, 22, 6, 6, { background: "#F4F7FB", borderRadius: p(2) })} />
          {/* Pupils */}
          <div style={abs(16, 23, 3, 4, { background: dark })} />
          <div style={abs(32, 23, 3, 4, { background: dark })} />
          {/* Tear drop */}
          <div style={abs(10, 24, 4, 6, { background: "#67E8F9", borderRadius: "0 " + p(4) + " " + p(4) + " " + p(4), opacity: 0.6, transform: "rotate(10deg)" })} />
          {/* Nose */}
          <div style={abs(23, 32, 4, 3, { background: accent, borderRadius: "50%" })} />
        </div>
      );

    /* ----- TOOL ABUSE (badger with wrench) ----- */
    case "tool_abuse":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          {/* Wide head */}
          <div style={abs(4, 8, 42, 26, { background: body, border: p(1.5) + " solid " + accent, borderRadius: p(6) + " " + p(6) + " " + p(4) + " " + p(4) })} />
          {/* Face stripe */}
          <div style={abs(20, 6, 10, 30, { background: dark, borderRadius: p(4), opacity: 0.3 })} />
          {/* Small ears */}
          <div style={abs(6, 3, 10, 8, { background: dark, borderRadius: p(4) + " " + p(4) + " " + p(1) + " " + p(1) })} />
          <div style={abs(34, 3, 10, 8, { background: dark, borderRadius: p(4) + " " + p(4) + " " + p(1) + " " + p(1) })} />
          {/* Eyes */}
          <div style={abs(12, 16, 6, 6, { background: "#F4F7FB", borderRadius: p(1) })} />
          <div style={abs(32, 16, 6, 6, { background: "#F4F7FB", borderRadius: p(1) })} />
          {/* Pupils */}
          <div style={abs(14, 18, 3, 4, { background: dark })} />
          <div style={abs(34, 18, 3, 4, { background: dark })} />
          {/* Wrench icon */}
          <div style={abs(36, 30, 14, 4, { background: accent, borderRadius: p(2), transform: "rotate(-20deg)", opacity: 0.7 })} />
          <div style={abs(44, 26, 4, 10, { background: accent, borderRadius: p(2), transform: "rotate(-20deg)", opacity: 0.7 })} />
        </div>
      );

    /* ----- EXTRACTION (owl with magnifier) ----- */
    case "policy_extraction":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          {/* Round head */}
          <div style={abs(6, 8, 38, 30, { background: body, border: p(1.5) + " solid " + accent, borderRadius: "50%" })} />
          {/* Ear tufts */}
          <div style={abs(6, 4, 8, 8, { background: accent, clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)", opacity: 0.5 })} />
          <div style={abs(36, 4, 8, 8, { background: accent, clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)", opacity: 0.5 })} />
          {/* Big eyes */}
          <div style={abs(12, 14, 10, 10, { background: "#F4F7FB", border: p(1.5) + " solid " + dark, borderRadius: "50%" })} />
          <div style={abs(28, 14, 10, 10, { background: "#F4F7FB", border: p(1.5) + " solid " + dark, borderRadius: "50%" })} />
          {/* Pupils */}
          <div style={abs(15, 17, 5, 5, { background: dark, borderRadius: "50%" })} />
          <div style={abs(31, 17, 5, 5, { background: dark, borderRadius: "50%" })} />
          {/* Beak */}
          <div style={abs(22, 28, 6, 5, { background: accent, clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)", opacity: 0.6 })} />
          {/* Magnifying glass */}
          <div style={abs(38, 30, 10, 10, { border: p(1.5) + " solid " + accent, borderRadius: "50%", opacity: 0.5 })} />
          <div style={abs(43, 38, 2, 8, { background: accent, borderRadius: p(1), transform: "rotate(45deg)", opacity: 0.5 })} />
        </div>
      );

    /* ----- ESCALATION (boss wolf) ----- */
    case "multi_turn_escalation":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          {/* Larger body */}
          <div style={abs(6, 10, 40, 30, { background: body, border: p(2) + " solid " + accent, borderRadius: p(4) })} />
          {/* Angular ears */}
          <div style={abs(6, 0, 12, 14, { background: dark, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", transform: "rotate(-5deg)" })} />
          <div style={abs(34, 0, 12, 14, { background: dark, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", transform: "rotate(5deg)" })} />
          {/* Angry brows */}
          <div style={abs(8, 15, 14, 3, { background: dark, borderRadius: p(1), transform: "rotate(-15deg)" })} />
          <div style={abs(30, 15, 14, 3, { background: dark, borderRadius: p(1), transform: "rotate(15deg)" })} />
          {/* Eyes */}
          <div style={abs(12, 18, 7, 6, { background: "#FBBF24", borderRadius: p(1) })} />
          <div style={abs(33, 18, 7, 6, { background: "#FBBF24", borderRadius: p(1) })} />
          {/* Pupils */}
          <div style={abs(14, 19, 3, 4, { background: "#111827" })} />
          <div style={abs(35, 19, 3, 4, { background: "#111827" })} />
          {/* Snout */}
          <div style={abs(16, 26, 20, 10, { background: dark, borderRadius: p(4), opacity: 0.4 })} />
          {/* Fangs */}
          <div style={abs(18, 32, 4, 5, { background: "#F4F7FB", clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" })} />
          <div style={abs(30, 32, 4, 5, { background: "#F4F7FB", clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" })} />
          {/* Crown marking */}
          <div style={abs(18, 4, 16, 6, { background: accent, borderRadius: p(2), opacity: 0.4 })} />
        </div>
      );

    default:
      return null;
  }
}
