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
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        brandViolet: {
          400: "#7dd3fc",
          500: "#38bdf8",
          600: "#0ea5e9",
          900: "#0c4a6e",
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
          "linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #38bdf8 100%)",
        "brand-accent":
          "linear-gradient(90deg, #2563eb 0%, #38bdf8 55%, #f59e0b 100%)",
        "app-mesh":
          "radial-gradient(ellipse 80% 50% at 100% -10%, rgba(37,99,235,0.16), transparent 55%), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(56,189,248,0.12), transparent 50%)",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(37, 99, 235, 0.1)",
        glow: "0 0 40px rgba(37, 99, 235, 0.16)",
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
