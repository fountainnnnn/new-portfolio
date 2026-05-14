
import { useState, useEffect, useRef, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface BattleEffectsLayerProps {
  activeEffects: string[];
  position: { x: number; y: number };
}

interface EffectInstance {
  id: number;
  type: string;
}

/* Duration per effect type (ms) */
const EFFECT_DURATIONS: Record<string, number> = {
  shieldBurst: 800,
  damage: 700,
  patchBeam: 1500,
  levelUp: 1400,
  slash: 500,
};

/* ------------------------------------------------------------------ */
/*  BattleEffectsLayer                                                */
/* ------------------------------------------------------------------ */

export default function BattleEffectsLayer({
  activeEffects,
  position,
}: BattleEffectsLayerProps) {
  const [instances, setInstances] = useState<EffectInstance[]>([]);
  const counterRef = useRef(0);
  const prevKeyRef = useRef("");

  /* Detect new effects by comparing serialized array content */
  useEffect(() => {
    const key = JSON.stringify(activeEffects);
    if (!activeEffects.length || key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    const newInstances: EffectInstance[] = activeEffects.map((type) => ({
      id: ++counterRef.current,
      type,
    }));

    setInstances((prev) => [...prev, ...newInstances]);

    /* Auto-remove each instance after its animation duration */
    newInstances.forEach(({ id, type }) => {
      const duration = EFFECT_DURATIONS[type] || 800;
      setTimeout(() => {
        setInstances((prev) => prev.filter((e) => e.id !== id));
      }, duration);
    });
  }, [activeEffects]);

  if (instances.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <style>{`
        @keyframes sh-ring-0 {
          0% { transform: scale(0.3); opacity: 0.9; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes sh-ring-1 {
          0% { transform: scale(0.2); opacity: 0.6; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        @keyframes sh-ring-2 {
          0% { transform: scale(0.1); opacity: 0.3; }
          100% { transform: scale(4); opacity: 0; }
        }
        @keyframes dmg-flash {
          0%, 100% { opacity: 0; }
          20% { opacity: 0.5; }
          50% { opacity: 0.15; }
        }
        @keyframes dmg-particle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        @keyframes patch-beam {
          0% { transform: scaleY(0); opacity: 0; }
          25% { transform: scaleY(1); opacity: 1; }
          70% { transform: scaleY(1); opacity: 0.6; }
          100% { transform: scaleY(0); opacity: 0; }
        }
        @keyframes patch-scan {
          0% { transform: translateY(-100%); opacity: 0; }
          25% { opacity: 1; }
          75% { opacity: 0.7; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes lvl-ring {
          0% { transform: scale(0.2); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes lvl-particle {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; }
          100% { transform: translateY(var(--ly)) translateX(var(--lx)) scale(0); opacity: 0; }
        }
        @keyframes slash-arc {
          0% { transform: scaleX(0); opacity: 0.8; }
          45% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0); opacity: 0; }
        }
      `}</style>

      {instances.map((inst) => {
        switch (inst.type) {
          case "shieldBurst":
            return <ShieldBurst key={inst.id} cx={position.x} cy={position.y} />;
          case "damage":
            return <DamageEffect key={inst.id} cx={position.x} cy={position.y} />;
          case "patchBeam":
            return <PatchBeam key={inst.id} cx={position.x} cy={position.y} />;
          case "levelUp":
            return <LevelUp key={inst.id} cx={position.x} cy={position.y} />;
          case "slash":
            return <SlashEffect key={inst.id} cx={position.x} cy={position.y} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual effect renderers                                       */
/* ------------------------------------------------------------------ */

function ShieldBurst({ cx, cy }: { cx: number; cy: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(${cx}% - 60px)`,
        top: `calc(${cy}% - 60px)`,
        width: 120,
        height: 120,
      }}
    >
      {/* Concentric rings with staggered delays */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "2px solid rgba(34, 211, 238, 0.55)",
          borderRadius: "50%",
          boxShadow: "0 0 24px rgba(34, 211, 238, 0.15), inset 0 0 24px rgba(34, 211, 238, 0.05)",
          animation: "sh-ring-0 0.7s ease-out forwards",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -8,
          border: "1.5px solid rgba(34, 211, 238, 0.3)",
          borderRadius: "50%",
          animation: "sh-ring-1 0.9s ease-out 0.1s forwards",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -16,
          border: "1px solid rgba(34, 211, 238, 0.15)",
          borderRadius: "50%",
          animation: "sh-ring-2 1.1s ease-out 0.2s forwards",
        }}
      />
    </div>
  );
}

function DamageEffect({ cx, cy }: { cx: number; cy: number }) {
  /* 6 particles bursting outward at evenly spaced angles */
  const particles = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * 360;
    const dist = 28 + ((i * 11 + 3) % 18);
    return {
      dx: Math.cos((angle * Math.PI) / 180) * dist,
      dy: Math.sin((angle * Math.PI) / 180) * dist,
      delay: i * 0.05,
    };
  }), []);

  return (
    <>
      {/* Dark red radial glow */}
      <div
        style={{
          position: "absolute",
          left: `calc(${cx}% - 70px)`,
          top: `calc(${cy}% - 70px)`,
          width: 140,
          height: 140,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(circle, rgba(248, 113, 113, 0.3) 0%, transparent 70%)",
            animation: "dmg-flash 0.45s ease-out forwards",
          }}
        />
      </div>

      {/* Red dot particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={
            {
              position: "absolute",
              left: `calc(${cx}% - 3px)`,
              top: `calc(${cy}% - 3px)`,
              width: 6,
              height: 6,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            } as React.CSSProperties
          }
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "#F87171",
              boxShadow: "0 0 4px rgba(248, 113, 113, 0.5)",
              animation: `dmg-particle 0.5s ease-out ${p.delay}s forwards`,
            }}
          />
        </div>
      ))}
    </>
  );
}

function PatchBeam({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      {/* Vertical purple-blue gradient beam */}
      <div
        style={{
          position: "absolute",
          left: `calc(${cx}% - 3px)`,
          top: 0,
          width: 6,
          height: "100%",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(167, 139, 250, 0.45) 30%, rgba(167, 139, 250, 0.7) 50%, rgba(167, 139, 250, 0.45) 70%, transparent 100%)",
            animation: "patch-beam 1.4s ease-out forwards",
            transformOrigin: "center",
          }}
        />
      </div>

      {/* Horizontal scan line crossing the beam */}
      <div
        style={{
          position: "absolute",
          left: `calc(${cx}% - 44px)`,
          top: `calc(${cy}% - 1px)`,
          width: 88,
          height: 2,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to right, transparent, rgba(167, 139, 250, 0.8), transparent)",
            animation: "patch-scan 1.2s ease-in-out forwards",
          }}
        />
      </div>
    </>
  );
}

function LevelUp({ cx, cy }: { cx: number; cy: number }) {
  /* 9 particles rising in staggered arcs: gold, purple, cyan alternating */
  const particles = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const spread = (i - 4) * 7;
    const riseY = -(45 + ((i * 13 + 7) % 35));
    return {
      lx: spread + ((i * 7) % 12) - 6,
      ly: riseY,
      color:
        i % 3 === 0
          ? "#A78BFA"
          : i % 3 === 1
            ? "#FBBF24"
            : "#22D3EE",
      shadow:
        i % 3 === 0
          ? "rgba(167, 139, 250, 0.6)"
          : i % 3 === 1
            ? "rgba(251, 191, 36, 0.6)"
            : "rgba(34, 211, 238, 0.6)",
      delay: i * 0.07,
    };
  }), []);

  return (
    <>
      {/* Expanding ring at base */}
      <div
        style={{
          position: "absolute",
          left: `calc(${cx}% - 40px)`,
          top: `calc(${cy}% - 40px)`,
          width: 80,
          height: 80,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "2px solid rgba(167, 139, 250, 0.25)",
            borderRadius: "50%",
            boxShadow: "0 0 20px rgba(167, 139, 250, 0.08)",
            animation: "lvl-ring 0.8s ease-out forwards",
          }}
        />
      </div>

      {/* Rising particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={
            {
              position: "absolute",
              left: `calc(${cx}% - 2.5px)`,
              top: `calc(${cy}% - 2.5px)`,
              width: 5,
              height: 5,
              "--lx": `${p.lx}px`,
              "--ly": `${p.ly}px`,
            } as React.CSSProperties
          }
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: p.color,
              boxShadow: `0 0 6px ${p.shadow}`,
              animation: `lvl-particle 1s ease-out ${p.delay}s forwards`,
            }}
          />
        </div>
      ))}
    </>
  );
}

function SlashEffect({ cx, cy }: { cx: number; cy: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(${cx}% - 40px)`,
        top: `calc(${cy}% - 8px)`,
        width: 80,
        height: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(to right, transparent, rgba(34, 211, 238, 0.5), rgba(248, 248, 255, 0.8), rgba(34, 211, 238, 0.5), transparent)",
          clipPath:
            "polygon(0 50%, 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%)",
          animation: "slash-arc 0.4s ease-out forwards",
        }}
      />
    </div>
  );
}
