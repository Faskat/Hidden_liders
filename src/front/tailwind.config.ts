import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        rulesWindowIn: {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(20px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        titleGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        rulePageIn: {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        ruleItemIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        bgShift: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.92" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in": "fadeIn 0.35s ease-out forwards",
        "slide-in": "slideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-in": "scaleIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "rules-window-in": "rulesWindowIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "title-glow": "titleGlow 3s ease-in-out infinite",
        "rule-page-in": "rulePageIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "rule-item-in": "ruleItemIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "bg-shift": "bgShift 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
