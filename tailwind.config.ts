import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#667085",
        line: "#D9E1EC"
      }
    }
  },
  plugins: []
};

export default config;
