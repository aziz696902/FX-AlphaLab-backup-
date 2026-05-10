import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        background: "#09090b",
        panel: "#0f1117",
        panel2: "#111827",
        accent: {
          bull: "#10b981",
          bear: "#fb7185",
          neon: "#22c55e",
          muted: "#3f3f46"
        },
        ink: {
          1: "#f8fafc",
          2: "#cbd5f5",
          3: "#7c89a6"
        }
      },
      boxShadow: {
        glow: "0 0 24px rgba(16, 185, 129, 0.15)",
        glowRed: "0 0 24px rgba(251, 113, 133, 0.2)"
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" }
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        }
      },
      animation: {
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        floatSlow: "floatSlow 6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
