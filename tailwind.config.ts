import type { Config } from "tailwindcss";

/**
 * Design language: "Control Tower"
 * - Ocean-teal primary (control-room calm), amber signal accent, steel neutrals.
 * - Light-first, with an opt-in dark variant driven by the `.dark` class.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: "#eefbfa",
          100: "#d3f5f2",
          200: "#abeae6",
          300: "#74d8d4",
          400: "#41bfbe",
          500: "#23a3a5",
          600: "#198387",
          700: "#19696c",
          800: "#1a5457",
          900: "#1b4749",
          950: "#082b2e",
        },
        signal: {
          50: "#fff8ed",
          100: "#ffefd3",
          200: "#ffdaa3",
          300: "#ffbe66",
          400: "#ff9a2e",
          500: "#f97b0a",
          600: "#e05c06",
          700: "#b84209",
          800: "#93340f",
          900: "#782c10",
        },
        steel: {
          50: "#f6f8fa",
          100: "#eceff3",
          200: "#d5dbe3",
          300: "#b0bcca",
          400: "#8597ac",
          500: "#667a92",
          600: "#51617a",
          700: "#424f65",
          800: "#3a4456",
          900: "#343b49",
          950: "#22262f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.18)",
        lift: "0 12px 40px -16px rgba(8,43,46,.45)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(34,38,47,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,38,47,.05) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(249,123,10,.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(249,123,10,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(249,123,10,0)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise .28s ease-out both",
        "pulse-ring": "pulse-ring 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
