import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: { extend: { colors: {
    bg: "var(--bg)", surface: "var(--surface)", card: "var(--card)", text: "var(--text)", muted: "var(--muted)",
    primary: "var(--primary)", accent: "var(--accent)", line: "var(--border)",
    ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", offline: "var(--offline)", sos: "var(--sos)",
    navy: "#071A33", deep: "#0B2D5C", sky: "#A8DEFF", ice: "#EFF7FF" },
    fontFamily: { sans: ["var(--font-sora)", "system-ui", "sans-serif"] } } },
} satisfies Config;
