import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        muted: "#6B7280",
        accent: { DEFAULT: "#D66A38", hover: "#E57C49", foreground: "#FFFFFF" },
        clay: { DEFAULT: "#C96A46", hover: "#B85A36" },
        parchment: "#FAF8F4",
        line: "#ECECEC",
        grid: "#F3F3F3",
        surface: "#FAFAFA",

        // ── shadcn/ui design tokens ──
        // The bundled ui/* primitives (button, badge, card, dialog,
        // dropdown-menu, calendar, alert, …) were authored against the
        // standard shadcn token names, but those were never defined —
        // so every one rendered with transparent backgrounds / invisible
        // text. Map them onto the existing brand palette here so the
        // primitives are visible without rewriting each component.
        background: "#FFFFFF",
        foreground: "#111111",
        card: { DEFAULT: "#FFFFFF", foreground: "#111111" },
        popover: { DEFAULT: "#FFFFFF", foreground: "#111111" },
        primary: { DEFAULT: "#D66A38", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#F3F4F6", foreground: "#111111" },
        destructive: { DEFAULT: "#DC2626", foreground: "#B91C1C" },
        info: { DEFAULT: "#2563EB", foreground: "#1D4ED8" },
        success: { DEFAULT: "#059669", foreground: "#047857" },
        warning: { DEFAULT: "#D97706", foreground: "#B45309" },
        "muted-foreground": "#6B7280",
        input: "#ECECEC",
        ring: "#D66A38",
        border: "#ECECEC",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 40px rgba(0,0,0,.06)",
        float: "0 30px 80px rgba(0,0,0,.08)",
        glow: "0 8px 24px rgba(214,106,56,.25)",
        "glow-lg": "0 12px 36px rgba(214,106,56,.35)",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        marquee: "marquee 36s linear infinite",
        floaty: "floaty 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
