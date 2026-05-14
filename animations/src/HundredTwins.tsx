import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "./theme";

/**
 * HUNDRED TWINS — The 100 Autoimmune Twins Project.
 *
 * A 10x10 grid of small twin glyphs. First one is gold (Glüten · Twin #1).
 * Remaining 99 are grey silhouettes, with a few labelled (Lupus, MS,
 * Hashimoto's, T1D, IBD, psoriasis, RA).
 *
 * Beats:
 *   00–20f: title
 *   30–110f: grid populates row by row
 *   120f:    Twin #1 lights up gold
 *   140f:    bottom caption fades in
 */
export const HundredTwins: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cols = 10;
  const rows = 10;
  const cell = 80;
  const gridW = cols * cell;
  const gridH = rows * cell;
  const gridX = (1920 - gridW) / 2;
  const gridY = 280;

  // Labelled disease badges (a sample, rest stay anonymous)
  const labels: Record<number, string> = {
    0: "Coeliac",
    1: "T1D",
    2: "Lupus",
    11: "MS",
    13: "Hashimoto",
    22: "IBD",
    24: "Psoriasis",
    36: "RA",
    45: "Sjögren",
    57: "AS",
    68: "Vitiligo",
    79: "Addison",
    88: "Graves",
  };

  const goldHighlight = spring({
    frame: frame - 120,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  const capOp = interpolate(frame, [140, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
        color: theme.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOp,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.accent,
            marginBottom: 10,
          }}
        >
          The 100 Autoimmune Twins Project
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 52,
            color: theme.ink,
            letterSpacing: "-0.02em",
          }}
        >
          Glüten is <em style={{ color: theme.accent, fontStyle: "italic" }}>Twin #1</em>.
        </div>
      </div>

      {/* Grid */}
      {Array.from({ length: rows * cols }).map((_, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const cx = gridX + c * cell + cell / 2;
        const cy = gridY + r * cell + cell / 2;

        // Stagger across grid: row * 8 + col * 0.6
        const appearStart = 30 + r * 8;
        const appearEnd = appearStart + 18;
        const appearProgress = interpolate(
          frame,
          [appearStart, appearEnd],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const isGlüten = idx === 0;
        const baseFill = isGlüten ? theme.accent : theme.line;
        const fill = isGlüten
          ? interpolate(goldHighlight, [0, 1], [0.6, 1]) * 1
            ? theme.accent
            : theme.accent
          : theme.line;
        const scale = isGlüten
          ? 0.6 + 0.5 * Math.max(appearProgress, goldHighlight)
          : 0.5 + 0.45 * appearProgress;

        return (
          <React.Fragment key={idx}>
            <div
              style={{
                position: "absolute",
                left: cx - 28 * scale,
                top: cy - 28 * scale,
                width: 56 * scale,
                height: 56 * scale,
                borderRadius: "50%",
                backgroundColor: fill,
                border: isGlüten ? `3px solid ${theme.ink}` : "none",
                boxShadow: isGlüten
                  ? `0 0 ${30 * goldHighlight}px rgba(212,168,67,0.6)`
                  : "none",
                opacity: appearProgress,
              }}
            />
            {labels[idx] && appearProgress > 0.8 && (
              <div
                style={{
                  position: "absolute",
                  left: cx - 70,
                  top: cy + 28,
                  width: 140,
                  textAlign: "center",
                  fontFamily: theme.mono,
                  fontSize: 13,
                  color: isGlüten ? theme.accent : theme.muted,
                  fontWeight: isGlüten ? 700 : 400,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  opacity: appearProgress,
                }}
              >
                {labels[idx]}
              </div>
            )}
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 70,
          textAlign: "center",
          fontFamily: theme.serif,
          fontSize: 28,
          color: theme.ink,
          opacity: capOp,
          padding: "0 96px",
        }}
      >
        The EU Virtual Human Twins roadmap funds cancer, cardiovascular, ICU, osteoporosis, and the brain.
        <br />
        <span style={{ color: theme.accent, fontStyle: "italic" }}>
          Autoimmune disease is not on it.
        </span>
      </div>
    </AbsoluteFill>
  );
};
