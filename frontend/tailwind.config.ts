import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-manrope)", "system-ui", "sans-serif"],
        body: ["var(--font-public-sans)", "system-ui", "sans-serif"],
      },
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
        surface: {
          DEFAULT: "#f8f9fa",
          container: "#ffffff",
          "container-high": "#f0f2f5",
          "container-highest": "#e7e8e9",
          dim: "#d9dadb",
        },
        "on-surface": {
          DEFAULT: "#191c1d",
          variant: "#41474e",
        },
        outline: {
          DEFAULT: "#72787f",
          variant: "#c1c7cf",
        },
        riasec: {
          r: "#e74c3c",
          i: "#3498db",
          a: "#9b59b6",
          s: "#2ecc71",
          e: "#e67e22",
          c: "#1abc9c",
        },
      },
      borderRadius: {
        sa: "4px",
      },
      spacing: {
        sidebar: "264px",
      },
      maxWidth: {
        admin: "1200px",
        public: "720px",
        "form-narrow": "640px",
        "form-compact": "560px",
        report: "800px",
      },
    },
  },
  plugins: [],
};
export default config;
