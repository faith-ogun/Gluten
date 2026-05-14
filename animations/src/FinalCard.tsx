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
 * FINAL CARD — wordmark + tagline + standards row + URL pill.
 *
 * Beats:
 *   00–25f: Glüten wordmark scales in
 *   30–60f: tagline fades up
 *   65–95f: subtagline fades up
 *   100–130f: standards row appears
 *   135f+:   URL pill
 */
export const FinalCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordmarkSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 130 },
  });

  const taglineOp = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineLift = interpolate(frame, [30, 60], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subOp = interpolate(frame, [65, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const stdsOp = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOp = interpolate(frame, [135, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const standards = [
    "Gemma 4",
    "Unsloth",
    "Ollama",
    "FHIR",
    "PubMed RAG",
    "IBDColEpi",
    "VDJdb",
    "Abraham 2014",
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
        color: theme.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 240,
          color: theme.ink,
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          transform: `scale(${wordmarkSpring})`,
          transformOrigin: "center",
        }}
      >
        Gl<span style={{ color: theme.accent }}>ü</span>ten
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: 36,
          fontFamily: theme.serif,
          fontSize: 56,
          color: theme.ink,
          textAlign: "center",
          letterSpacing: "-0.01em",
          opacity: taglineOp,
          transform: `translateY(${taglineLift}px)`,
        }}
      >
        Your body. Your data. Your twin.
      </div>

      {/* Sub-tagline */}
      <div
        style={{
          marginTop: 18,
          fontSize: 26,
          color: theme.muted,
          textAlign: "center",
          maxWidth: 1200,
          lineHeight: 1.4,
          opacity: subOp,
          padding: "0 96px",
        }}
      >
        Bridging humans and data through digital twins for chronic autoimmune disease.
      </div>

      {/* Standards row */}
      <div
        style={{
          marginTop: 60,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
          opacity: stdsOp,
          maxWidth: 1500,
        }}
      >
        {standards.map((s) => (
          <span
            key={s}
            style={{
              padding: "10px 18px",
              fontFamily: theme.mono,
              fontSize: 18,
              color: theme.ink,
              backgroundColor: theme.bg2,
              border: `1.5px solid ${theme.accent}`,
              borderRadius: 999,
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* URL pill */}
      <div
        style={{
          marginTop: 48,
          padding: "16px 30px",
          backgroundColor: theme.ink,
          color: theme.accentBright,
          borderRadius: 999,
          fontFamily: theme.mono,
          fontSize: 24,
          opacity: urlOp,
        }}
      >
        gluten.app
      </div>
    </AbsoluteFill>
  );
};
