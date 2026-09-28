import type { Config } from "tailwindcss";

// Herramienta interna para un equipo de desarrollo: superficie casi blanca,
// jerarquía por borde y peso tipográfico, color reservado para estado.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lienzo: "#FCFCFC", // fondo de la app
        panel: "#FFFFFF",
        borde: "#E7E7EA",
        borde2: "#D6D6DB", // borde de control, un paso más marcado
        tinta: {
          DEFAULT: "#0E0E12",
          suave: "#61616E",
          tenue: "#96969F",
        },
        acento: "#3B5BFF", // acción y foco; nunca decorativo
        estado: {
          espera: "#B45309",
          firmado: "#087443",
          anulado: "#96969F",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        ajustado: "-0.02em", // títulos en display: más compactos
      },
      boxShadow: {
        sutil: "0 1px 2px 0 rgba(14,14,18,0.05)",
        alzada: "0 4px 12px -4px rgba(14,14,18,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
