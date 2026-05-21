import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          900: "#0f172a",
        },
      },
      boxShadow: {
        glow: "0 30px 80px -30px rgba(249, 115, 22, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
