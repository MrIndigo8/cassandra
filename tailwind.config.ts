import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#10B981",
          hover: "#059669",
        },
        secondary: "#38BFF8",
        background: "#FFFFFF",
        surface: "#F9FAFB",
        border: "#E5E7EB",
        text: {
          primary: "#1F2937",
          secondary: "#6B7280",
        },
        accent: "#10B981",

        // --- Design tokens used by the current UI ---
        "void-border": "#E5E7EB",
        void: "#0B1020",
        cosmos: "#0B1020",
        aurora: "#10B981",

        "mist": "#E5E7EB",
        "mist-dim": "#9CA3AF",
        "mist-faint": "#6B7280",

        "cassandra-900": "#0B1020",
        "cassandra-700": "#111827",
        "cassandra-300": "#D1D5DB",

        dream: "#38BDF8",
        match: "#F59E0B",

        "accent-light": "#34D399",
        danger: "#EF4444",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.65", transform: "scale(1.02)" },
        },
        "ping-slow": {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 450ms ease-out both",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        "ping-slow": "ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      boxShadow: {
        "glow-sm": "0 0 18px rgba(16, 185, 129, 0.35)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        "xl": "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
