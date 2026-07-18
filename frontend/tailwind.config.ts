import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-vazir)", "Tahoma", "Arial", "sans-serif"],
        vazir: ["var(--font-vazir)", "Tahoma", "Arial", "sans-serif"],
      },
      colors: {
        app: {
          DEFAULT: "var(--bg)",
          fg: "var(--text)",
          muted: "var(--muted)",
          card: "var(--card)",
          border: "var(--border)",
          ring: "var(--ring)",
          accent: "var(--accent)",
          "accent-2": "var(--accent-2)",
          gold: "var(--gold)",
        },
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        brandViolet: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          900: "#4c1d95",
        },
        brandGold: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        brandNavy: {
          900: "#0b1220",
          950: "#050a14",
        },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #4c1d95 0%, #0b1220 45%, #155e75 100%)",
        "brand-accent":
          "linear-gradient(90deg, #06b6d4 0%, #8b5cf6 55%, #f59e0b 100%)",
        "app-mesh":
          "radial-gradient(circle at top right, rgba(6,182,212,0.08), transparent 28%), radial-gradient(circle at bottom left, rgba(139,92,246,0.1), transparent 24%)",
      },
      boxShadow: {
        soft: "0 10px 32px rgba(15, 23, 42, 0.06)",
        glow: "0 0 40px rgba(6, 182, 212, 0.18)",
      },
      borderRadius: {
        antd: "16px",
      },
      maxWidth: {
        page: "56rem",
      },
    },
  },
  plugins: [],
};

export default config;
