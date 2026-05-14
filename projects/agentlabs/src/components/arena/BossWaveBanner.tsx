
import React, { useState, useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BossWaveBannerProps {
  bossWave: boolean;
  bossType?: string;
  waveNumber?: number;
}

/* ------------------------------------------------------------------ */
/*  CSS keyframes injected once                                       */
/* ------------------------------------------------------------------ */

const STYLES_ID = "boss-wave-banner-styles";

function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLES_ID)) return;

  const style = document.createElement("style");
  style.id = STYLES_ID;
  style.textContent = `
    @keyframes boss-banner-enter {
      0% {
        opacity: 0;
        transform: scale(0.5) translateY(-20px);
      }
      60% {
        opacity: 1;
        transform: scale(1.08) translateY(0);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    @keyframes boss-banner-exit {
      0% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      100% {
        opacity: 0;
        transform: scale(0.8) translateY(-30px);
      }
    }
    @keyframes boss-banner-pulse {
      0%, 100% {
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
      }
      50% {
        box-shadow: 0 0 24px rgba(239, 68, 68, 0.6);
      }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  BossWaveBanner                                                    */
/* ------------------------------------------------------------------ */

export default function BossWaveBanner({
  bossWave,
  bossType,
  waveNumber,
}: BossWaveBannerProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    injectStyles();
    mountedRef.current = true;
    setMounted(true);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!bossWave) {
      setVisible(false);
      setExiting(false);
      return;
    }

    /* Show banner */
    setVisible(true);
    setExiting(false);

    /* Start exit after 1.5s hold */
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setExiting(true);
      /* Remove from DOM after exit animation */
      setTimeout(() => {
        if (!mountedRef.current) return;
        setVisible(false);
        setExiting(false);
      }, 500);
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bossWave]);

  if (!visible && !exiting) return null;

  const displayType = bossType ?? "Escalation";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "16px",
          padding: "28px 52px",
          textAlign: "center",
          animation: exiting
            ? "boss-banner-exit 0.4s ease-in forwards"
            : "boss-banner-enter 0.4s ease-out forwards",
          animationPlayState: visible ? "running" : "paused",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#EF4444",
            marginBottom: "6px",
          }}
        >
          BOSS WAVE
        </div>
        <div
          style={{
            fontSize: "20px",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700,
            color: "#FCA5A5",
          }}
        >
          {displayType.replace(/_/g, " ")}
        </div>
        {waveNumber && (
          <div
            style={{
              fontSize: "11px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 500,
              color: "#9CA3AF",
              marginTop: "4px",
            }}
          >
            Wave {waveNumber}
          </div>
        )}
      </div>
    </div>
  );
}
