// Glüten brand tokens, mirrored from web/src/app/globals.css so the
// cutaways and the live UI read as one continuous identity.
export const theme = {
  cream: "#FAF7F2",
  wheatPale: "#FDF8EE",
  wheatLight: "#F5E6C4",
  wheat: "#D4A843",
  wheatDeep: "#B8902F",
  charcoal: "#2D2A24",
  deep: "#1A1712",
  warm: "#6B6560",
  line: "#E8E4DF",
  safe: "#3D8B5E",
  alert: "#C94432",
  info: "#4A7FB5",

  // Aliases used inside compositions
  bg: "#FAF7F2",
  bg2: "#FDF8EE",
  ink: "#1A1712",
  ink2: "#2D2A24",
  muted: "#6B6560",
  accent: "#B8902F",
  accentBright: "#D4A843",
  accentSoft: "#F5E6C4",

  serif:
    "'DM Serif Display', 'Fraunces', 'Cormorant Garamond', Georgia, serif",
  sans:
    "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif",
  mono:
    "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace",
} as const;
