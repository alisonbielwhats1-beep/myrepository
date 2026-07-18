import type { Config } from "tailwindcss";

/**
 * Design tokens do GymFlow.
 * Paleta vibrante estilo "app de treino premium" com base escura (dark mode nativo),
 * acentos em lima/verde-energia e magenta, e superfícies com profundidade.
 */
// Cor via CSS var (RGB separado por espaço) preservando os utilitários de
// opacidade do Tailwind (ex: bg-ink-800/80). As variáveis trocam por tema.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fundos/superfícies/bordas — trocam entre escuro e claro por tema.
        ink: {
          950: v("ink-950"),
          900: v("ink-900"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
          500: v("ink-500"),
        },
        // Texto forte (títulos). Literalmente branco no escuro, quase-preto no claro.
        white: v("fg-strong"),
        // Escala de texto secundário/terciário — também troca por tema.
        slate: {
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
        },
        volt: {
          50: "#f2ffe0",
          100: "#e3ffc2",
          200: "#c9ff85",
          300: "#adff42",
          400: "#93f312",
          500: "#7ad600",
          600: "#5faa00",
          700: "#487f06",
          800: "#3a640c",
          900: "#31540f",
        },
        magenta: {
          400: "#ff4dd8",
          500: "#f81cc0",
          600: "#d3009e",
        },
        cyanx: {
          400: "#3ee6ff",
          500: "#00cffa",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(173, 255, 66, 0.45)",
        "glow-magenta": "0 0 40px -8px rgba(248, 28, 192, 0.45)",
        card: "0 20px 60px -25px rgba(0, 0, 0, 0.85)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(173,255,66,0.08), transparent 60%)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.4rem",
        "3xl": "2rem",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.3)", opacity: "0" },
          "100%": { opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.2, 0.5, 0.3, 1) infinite",
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
