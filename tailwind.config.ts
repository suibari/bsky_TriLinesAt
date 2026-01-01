import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],

  theme: {
    extend: {
      fontFamily: {
        sans: ['"Outfit"', 'sans-serif'],
      },
      colors: {
        // Custom glass colors
        glass: {
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
          dark: 'rgba(0, 0, 0, 0.3)',
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    }
  },

  plugins: []
} as Config;
