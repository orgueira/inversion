import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./frontend/src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "market-up": "#16a34a",
        "market-down": "#dc2626",
        "market-sideways": "#6b7280",
      },
    },
  },
  plugins: [],
};
export default config;