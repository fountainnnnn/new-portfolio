import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "app-bg": "#FCFCF7",
        "canvas-bg": "#FAF9F6",
        "panel-bg": "#FDFDFD",
        "warm-card": "#FBF5DF",
        "cool-card": "#F2F8FC",
        "lavender-card": "#F4F1F8",
        "soft-blue": "#F0F8FF",
        border: {
          DEFAULT: "#DCD8CC",
          strong: "#C7C2B8",
        },
        text: {
          primary: "#1D1D1F",
          secondary: "#575A60",
          muted: "#7A7D85",
        },
        success: "#21865A",
        danger: "#C2414B",
        warning: "#C77700",
        info: "#2563EB",
        purple: "#7C3AED",
        shield: "#0284C7",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        pixel: ['"Press Start 2P"', "monospace"],
      },
      fontSize: {
        "panel-heading": [
          "11px",
          { lineHeight: "1.4", letterSpacing: "0.08em", fontWeight: "700" },
        ],
        metric: ["28px", { lineHeight: "1.1", fontWeight: "750" }],
        "metric-lg": ["32px", { lineHeight: "1.1", fontWeight: "750" }],
        log: ["12px", { lineHeight: "1.5" }],
      },
      spacing: {
        "0.5": "4px",
        "1": "8px",
        "1.5": "12px",
        "2": "16px",
        "2.5": "20px",
        "3": "24px",
        "3.5": "28px",
        "4": "32px",
        "5": "40px",
        "6": "48px",
        "7": "56px",
        "8": "64px",
      },
      borderRadius: {
        sm: "8px",
        card: "12px",
        arena: "20px",
        btn: "10px",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        "flash-red": {
          "0%": { boxShadow: "0 0 0 0 rgba(194,65,75,0.5)" },
          "100%": { boxShadow: "0 0 0 12px rgba(194,65,75,0)" },
        },
        "flash-blue": {
          "0%": { boxShadow: "0 0 0 0 rgba(37,99,235,0.4)" },
          "100%": { boxShadow: "0 0 0 14px rgba(37,99,235,0)" },
        },
        "beam-up": {
          "0%": {
            opacity: "1",
            transform: "scaleY(0)",
            transformOrigin: "bottom",
          },
          "50%": {
            opacity: "1",
            transform: "scaleY(1)",
            transformOrigin: "bottom",
          },
          "100%": {
            opacity: "0",
            transform: "scaleY(0)",
            transformOrigin: "top",
          },
        },
        "particle-rise": {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": {
            opacity: "0",
            transform: "translateY(-40px) scale(0)",
            transformOrigin: "center",
          },
        },
        "fade-out-down": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(8px)" },
        },
        "slide-left": {
          "0%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-80px)" },
          "100%": { transform: "translateX(0)" },
        },
        "enemy-lunge": {
          "0%": { transform: "translateX(0)" },
          "40%": { transform: "translateX(-70px)" },
          "100%": { transform: "translateX(0)" },
        },
        "shield-pulse": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(2,132,199,0.4)",
            transform: "scale(1)",
            opacity: "1",
          },
          "100%": {
            boxShadow: "0 0 0 20px rgba(2,132,199,0)",
            transform: "scale(1.5)",
            opacity: "0",
          },
        },
      },
      animation: {
        bob: "bob 1.8s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out",
        "flash-red": "flash-red 0.6s ease-out",
        "flash-blue": "flash-blue 0.5s ease-out",
        "beam-up": "beam-up 1s ease-out forwards",
        "particle-rise": "particle-rise 1.2s ease-out forwards",
        "fade-out-down": "fade-out-down 0.6s ease-in forwards",
        "slide-left": "slide-left 0.5s ease-out",
        "enemy-lunge": "enemy-lunge 0.7s ease-in-out",
        "shield-pulse": "shield-pulse 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
