import type { Config } from "tailwindcss";

// Note: Additional animations for notifications
// - slide-in-right: For toast notifications sliding in from right
// - achievement-pop: Bouncy pop-in for achievement modals
// - float-particle: Floating particles for celebration effects

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        vicoin: "hsl(var(--vicoin))",
        icoin: "hsl(var(--icoin))",
        neon: {
          purple: "hsl(var(--neon-purple))",
          magenta: "hsl(var(--neon-magenta))",
          cyan: "hsl(var(--neon-cyan))",
          blue: "hsl(var(--neon-blue))",
          pink: "hsl(var(--neon-pink))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ['Rajdhani', 'sans-serif'],
        display: ['Orbitron', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "coin-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-3d": {
          "0%, 100%": { 
            transform: "scale(1) translateZ(0)",
            boxShadow: "0 0 0 0 hsl(var(--primary) / 0.4)",
          },
          "50%": { 
            transform: "scale(1.05) translateZ(5px)",
            boxShadow: "0 0 20px 10px hsl(var(--primary) / 0.2)",
          },
        },
        "float-3d": {
          "0%, 100%": { 
            transform: "translateY(0) perspective(500px) rotateX(0deg)",
          },
          "50%": { 
            transform: "translateY(-8px) perspective(500px) rotateX(5deg)",
          },
        },
        "glow-ambient": {
          "0%, 100%": { 
            boxShadow: "0 0 20px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.1)",
          },
          "50%": { 
            boxShadow: "0 0 30px hsl(var(--primary) / 0.5), 0 0 60px hsl(var(--primary) / 0.2)",
          },
        },
        "tilt-3d": {
          "0%": { transform: "perspective(1000px) rotateY(-5deg) rotateX(5deg)" },
          "50%": { transform: "perspective(1000px) rotateY(5deg) rotateX(-5deg)" },
          "100%": { transform: "perspective(1000px) rotateY(-5deg) rotateX(5deg)" },
        },
        "morph-blob": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
          "50%": { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" },
        },
        "neon-pulse": {
          "0%, 100%": { 
            boxShadow: "0 0 20px hsl(270 95% 65% / 0.3), 0 0 40px hsl(270 95% 65% / 0.1)",
          },
          "50%": { 
            boxShadow: "0 0 40px hsl(270 95% 65% / 0.5), 0 0 80px hsl(320 90% 60% / 0.2)",
          },
        },
        "coin-pulse": {
          "0%, 100%": { 
            transform: "scale(1)",
            opacity: "1",
          },
          "50%": { 
            transform: "scale(1.05)",
            opacity: "0.9",
          },
        },
        "glow-ring-icoin": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 hsl(45 100% 55% / 0.4), 0 0 15px hsl(45 100% 55% / 0.2)",
          },
          "50%": { 
            boxShadow: "0 0 0 6px hsl(45 100% 55% / 0), 0 0 25px hsl(45 100% 55% / 0.4)",
          },
        },
        "glow-ring-vicoin": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 hsl(270 95% 65% / 0.4), 0 0 15px hsl(270 95% 65% / 0.2)",
          },
          "50%": { 
            boxShadow: "0 0 0 6px hsl(270 95% 65% / 0), 0 0 25px hsl(270 95% 65% / 0.4)",
          },
        },
        "glow-rotate": {
          "0%": { 
            filter: "hue-rotate(0deg)",
          },
          "100%": { 
            filter: "hue-rotate(360deg)",
          },
        },
        "float-neon": {
          "0%, 100%": { 
            transform: "translateY(0)",
            filter: "drop-shadow(0 0 10px hsl(270 95% 65% / 0.5))",
          },
          "50%": { 
            transform: "translateY(-10px)",
            filter: "drop-shadow(0 0 20px hsl(320 90% 60% / 0.5))",
          },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(8px)" },
        },
        "slide-left": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-8px)" },
        },
        "slide-right": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(8px)" },
        },
        "tap": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.9)" },
        },
        "micro-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "stagger-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "achievement-pop": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "float-particle": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-100px) scale(0)", opacity: "0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "coin-bounce": "coin-bounce 1s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "pulse-3d": "pulse-3d 2s ease-in-out infinite",
        "float-3d": "float-3d 3s ease-in-out infinite",
        "glow-ambient": "glow-ambient 3s ease-in-out infinite",
        "tilt-3d": "tilt-3d 6s ease-in-out infinite",
        "morph-blob": "morph-blob 8s ease-in-out infinite",
        "neon-pulse": "neon-pulse 2s ease-in-out infinite",
        "glow-rotate": "glow-rotate 8s linear infinite",
        "float-neon": "float-neon 3s ease-in-out infinite",
        "coin-pulse": "coin-pulse 2.5s ease-in-out infinite",
        "glow-ring-icoin": "glow-ring-icoin 2s ease-in-out infinite",
        "glow-ring-vicoin": "glow-ring-vicoin 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "fade-out": "fade-out 0.3s ease-out forwards",
        "slide-left": "slide-left 1s ease-in-out infinite",
        "slide-right": "slide-right 1s ease-in-out infinite",
        "tap": "tap 0.5s ease-in-out infinite",
        "micro-bounce": "micro-bounce 0.3s ease-out",
        "stagger-in": "stagger-in 0.4s ease-out forwards",
        "wiggle": "wiggle 0.5s ease-in-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "achievement-pop": "achievement-pop 0.4s ease-out",
        "float-particle": "float-particle 1.5s ease-out forwards",
        "pulse-slow": "pulse-slow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
