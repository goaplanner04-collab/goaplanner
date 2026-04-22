/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        bgPrimary: "#0A0A0F",
        bgCard: "rgba(255,255,255,0.05)",
        neonPink: "#FF2D78",
        neonCyan: "#00F5FF",
        neonGold: "#FFD700",
        textPrimary: "#FFFFFF",
        textMuted: "#8A8A9A",
        borderGlass: "rgba(255,255,255,0.1)"
      },
      fontFamily: {
        heading: ["'Bebas Neue'", "sans-serif"],
        body: ["'Inter'", "sans-serif"]
      },
      keyframes: {
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        pulseNeon: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.05)" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        gradientShift: "gradientShift 12s ease infinite",
        pulseNeon: "pulseNeon 1.6s ease-in-out infinite",
        fadeUp: "fadeUp 0.6s ease-out forwards",
        slideIn: "slideIn 0.4s ease-out forwards"
      }
    }
  },
  plugins: []
};
