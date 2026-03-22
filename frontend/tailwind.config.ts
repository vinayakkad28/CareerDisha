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
          DEFAULT: "#1a5276",
          50: "#eef5fa",
          100: "#d4e6f1",
          200: "#a9cce3",
          300: "#7fb3d5",
          400: "#5499c7",
          500: "#2980b9",
          600: "#1a5276",
          700: "#154360",
          800: "#0e2f44",
          900: "#071928",
        },
        secondary: {
          DEFAULT: "#d4ac0d",
          50: "#fdf8e8",
          100: "#faefc5",
          200: "#f5df8b",
          300: "#f0cf51",
          400: "#d4ac0d",
          500: "#b7950b",
          600: "#9a7d09",
        },
        accent: {
          DEFAULT: "#2ecc71",
          50: "#eafaf1",
          100: "#d5f5e3",
          200: "#abebc6",
          300: "#82e0aa",
          400: "#58d68d",
          500: "#2ecc71",
          600: "#27ae60",
        },
      },
    },
  },
  plugins: [],
};
export default config;
