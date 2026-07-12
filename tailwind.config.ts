import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18202f",
        mist: "#f6f8fb",
        line: "#dce3ec",
        apprentice: {
          teal: "#0e9888",
          amber: "#d97706",
          blue: "#3157d5",
          dark: "#101828"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 24, 40, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
