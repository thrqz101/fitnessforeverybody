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
        ink: "#1d2a22",
        paper: "#f8f6ef",
        moss: "#3f7354",
        mint: "#dff1db",
        coral: "#ee765e",
        citrus: "#f2ce67",
        skyglass: "#dcebed"
      },
      boxShadow: {
        soft: "0 24px 70px rgba(44, 71, 54, 0.12)",
        float: "0 30px 80px rgba(44, 71, 54, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
