import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101814",
        paper: "#f8f7f2",
        moss: "#246b4f",
        mint: "#d9f7df",
        coral: "#ff6f5e",
        citrus: "#f4c84a",
        skyglass: "#dceef7"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 24, 20, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
