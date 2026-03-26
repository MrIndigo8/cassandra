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

        // Тема: тёмный космос, мистика, предсказания
        "void-border": "#1e293b",
        void: "#0f172a",
        cosmos: "#0c1222",
        aurora: "#0f3460",
        mist: {
          DEFAULT: "#94a3b8",
          dim: "#64748b",
          faint: "#475569",
        },
        cassandra: {
          300: "#818cf8",
          700: "#312e81",
          900: "#1e1b4b",
        },
        dream: "#6366f1",
        match: "#10B981",
        danger: "#ef4444",
        "accent-light": "#34d399",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        likePop: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.25)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 3s cubic-bezier(0, 0, 0.2, 1) infinite",
        "like-pop": "likePop 0.25s ease-in-out",
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(16, 185, 129, 0.3)",
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
