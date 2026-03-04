import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f8ff",
          100: "#dfe9ff",
          200: "#bfd3ff",
          300: "#90b3ff",
          400: "#628fff",
          500: "#3f6df4",
          600: "#2f57d8",
          700: "#2546ae",
          800: "#213d89",
          900: "#203866"
        }
      }
    }
  },
  plugins: []
};

export default config;
