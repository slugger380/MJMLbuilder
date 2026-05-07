import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#17935E",
        "brand-dark": "#0F6F47",
        "brand-soft": "#E9F8F0",
        chrome: "#FAFAFA",
        "chrome-line": "#D9DDE5",
        code: "#101828",
        ink: "#172033",
        muted: "#667085",
        line: "#D9E1EC",
        panel: "#F8FAFC",
        surface: "#F4F7FB"
      }
    }
  },
  plugins: []
};

export default config;
