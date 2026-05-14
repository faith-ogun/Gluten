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
 * DUAL ENTRY — the two-mode pipeline.
 *
 *   [Screen mode] ─┐
 *                  ├─▶ [Six-layer disease twin engine]
 *   [Twin mode]   ─┘
 *
 * Beats:
 *   00–25f: title
 *   30–55f: left card (Screen) drops in
 *   55–80f: right card (Twin) drops in
 *   85–115f: arrows draw toward centre
 *   120–150f: engine pops in
 *   160f+: subcaption
 */
export const DualEntry: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleLift = interpolate(frame, [0, 25], [12, 0], {
    extrapolateRight: "clamp",
  });

  const screenSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 16, stiffness: 120 },
  });
  const twinSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const arrow1 = interpolate(frame, [85, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrow2 = interpolate(frame, [95, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const engineSpring = spring({
    frame: frame - 120,
    fps,
    config: { damping: 14, stiffness: 140 },
  });

  // Land the subcap fully by frame 150 so it has ~1.5s of dwell before the
  // composition ends at frame 195. Previously fired so late it never
  // finished fading in within the 165-frame render.
  const subcapOp = interpolate(frame, [125, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const Card = ({
    eyebrow,
    title,
    desc,
    color,
    scale,
    x,
    y,
  }: {
    eyebrow: string;
    title: string;
    desc: string;
    color: string;
    scale: number;
    x: number;
    y: number;
  }) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 480,
        padding: 36,
        backgroundColor: theme.bg2,
        border: `2px solid ${color}`,
        borderRadius: 16,
        boxShadow: "0 18px 40px rgba(0,0,0,0.06)",
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color,
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 48,
          lineHeight: 1.05,
          color: theme.ink,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 22,
          color: theme.ink2,
          lineHeight: 1.4,
        }}
      >
        {desc}
      </div>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
        color: theme.ink,
        padding: 64,
      }}
    >
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 64,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: theme.ink,
          textAlign: "center",
          opacity: titleOp,
          transform: `translateY(${titleLift}px)`,
          marginTop: 24,
        }}
      >
        One app. Two entry points.
      </div>
      <div
        style={{
          fontSize: 24,
          color: theme.muted,
          textAlign: "center",
          marginTop: 8,
          opacity: titleOp,
        }}
      >
        One six-layer engine.
      </div>

      {/* Left card — Screen mode */}
      <Card
        eyebrow="Screen mode"
        title="Catch the undiagnosed 70%."
        desc="GP enters non-specific symptoms. Returns risk + demographic-aware test advisory."
        color={theme.info}
        scale={screenSpring}
        x={120}
        y={300}
      />

      {/* Right card — Twin mode */}
      <Card
        eyebrow="Twin mode"
        title="Project the trajectory."
        desc="GP enters confirmed CD data. Six-layer twin returns projection + per-layer confidence."
        color={theme.accent}
        scale={twinSpring}
        x={1320}
        y={300}
      />

      {/* Engine */}
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 380,
          width: 400,
          height: 280,
          backgroundColor: theme.ink,
          color: theme.cream,
          borderRadius: 20,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          transform: `scale(${engineSpring})`,
          transformOrigin: "center",
          boxShadow: "0 24px 60px rgba(212,168,67,0.18)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.accentBright,
            marginBottom: 14,
          }}
        >
          Disease twin engine
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 42,
            lineHeight: 1.05,
            color: theme.cream,
            marginBottom: 12,
          }}
        >
          Six layers, one query.
        </div>
        <div
          style={{
            fontSize: 20,
            color: theme.wheatLight,
            lineHeight: 1.4,
          }}
        >
          Gemma 4 31B · 256K context · PubMed-grounded
        </div>
      </div>

      {/* Arrows */}
      <svg
        viewBox="0 0 1920 1080"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <marker
            id="arrow-info"
            markerWidth="12"
            markerHeight="12"
            refX="8"
            refY="6"
            orient="auto"
          >
            <path d="M0,0 L10,6 L0,12 Z" fill={theme.info} />
          </marker>
          <marker
            id="arrow-accent"
            markerWidth="12"
            markerHeight="12"
            refX="8"
            refY="6"
            orient="auto"
          >
            <path d="M0,0 L10,6 L0,12 Z" fill={theme.accent} />
          </marker>
        </defs>
        <line
          x1={600}
          x2={600 + 150 * arrow1}
          y1={520}
          y2={520}
          stroke={theme.info}
          strokeWidth={5}
          markerEnd={arrow1 > 0.95 ? "url(#arrow-info)" : undefined}
        />
        <line
          x1={1320}
          x2={1320 - 150 * arrow2}
          y1={520}
          y2={520}
          stroke={theme.accent}
          strokeWidth={5}
          markerEnd={arrow2 > 0.95 ? "url(#arrow-accent)" : undefined}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 64,
          textAlign: "center",
          fontSize: 22,
          color: theme.muted,
          opacity: subcapOp,
        }}
      >
        Powered end-to-end by Gemma 4 · E4B for clinician input · 31B for twin reasoning
      </div>
    </AbsoluteFill>
  );
};
