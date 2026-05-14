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
 * IBDColEpiPivot — the data-access pivot, with the literal authors' quote.
 *
 * Left card: Cambridge duodenum WSIs (the would-have-been benchmark) with
 *            a red "DSA-locked · IRAS 162057" stamp.
 * Right card: IBDColEpi colon WSIs, CC0, transferable.
 * Arrow connects them, with the actual quoted line from Pettersen et al.:
 *   "like celiac disease ... quantification of IEL is part of the pathologist's job."
 *
 * Beats:
 *   00–25f: title
 *   30–55f: left card slides in
 *   55–80f: stamp lands
 *   85–110f: right card slides in
 *   115–140f: arrow + quote ribbon
 *   150f:    citation
 */
export const IBDColEpiPivot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  const leftSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 16, stiffness: 120 },
  });
  const stampSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 10, stiffness: 200 },
  });
  const rightSpring = spring({
    frame: frame - 85,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const arrow = interpolate(frame, [115, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const quoteOp = interpolate(frame, [125, 155], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const citationOp = interpolate(frame, [165, 185], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          textAlign: "center",
          opacity: titleOp,
          marginTop: 12,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.accent,
            marginBottom: 12,
          }}
        >
          The data-access pivot
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            color: theme.ink,
            letterSpacing: "-0.02em",
          }}
        >
          Building on a public foundation, on purpose.
        </div>
      </div>

      {/* Left card — locked duodenum */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 280,
          width: 720,
          height: 520,
          backgroundColor: theme.bg2,
          border: `2px solid ${theme.line}`,
          borderRadius: 18,
          padding: 36,
          transform: `scale(${leftSpring})`,
          transformOrigin: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.alert,
            marginBottom: 10,
          }}
        >
          Cambridge duodenum WSIs
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 36,
            color: theme.ink,
            lineHeight: 1.1,
            marginBottom: 18,
          }}
        >
          The state-of-the-art coeliac biopsy benchmark.
        </div>
        <div
          style={{
            fontSize: 20,
            color: theme.ink2,
            lineHeight: 1.45,
            marginBottom: 24,
          }}
        >
          NEJM AI 2025 · 3,383 duodenal WSIs · 96% pathologist-level accuracy.
        </div>

        {/* Pathology pattern (simple grid simulating tissue) */}
        <div
          style={{
            height: 200,
            backgroundColor: theme.wheatPale,
            borderRadius: 10,
            opacity: 0.45,
            backgroundImage:
              "radial-gradient(circle at 25% 30%, rgba(184,144,47,0.45) 0 14px, transparent 15px), radial-gradient(circle at 70% 60%, rgba(184,144,47,0.35) 0 10px, transparent 11px), radial-gradient(circle at 50% 80%, rgba(184,144,47,0.30) 0 18px, transparent 19px)",
            backgroundSize: "120px 120px",
          }}
        />

        {/* Stamp */}
        <div
          style={{
            position: "absolute",
            right: 32,
            top: 32,
            padding: "10px 18px",
            border: `3px solid ${theme.alert}`,
            color: theme.alert,
            fontFamily: theme.mono,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.1em",
            transform: `rotate(-8deg) scale(${stampSpring})`,
            transformOrigin: "center",
            backgroundColor: "rgba(201,68,50,0.06)",
            textTransform: "uppercase",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          DSA-locked
          <br />
          IRAS 162057
        </div>
      </div>

      {/* Right card — CC0 colon */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 280,
          width: 720,
          height: 520,
          backgroundColor: theme.bg2,
          border: `2px solid ${theme.accent}`,
          borderRadius: 18,
          padding: 36,
          transform: `scale(${rightSpring})`,
          transformOrigin: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.safe,
            marginBottom: 10,
          }}
        >
          IBDColEpi colon WSIs
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 36,
            color: theme.ink,
            lineHeight: 1.1,
            marginBottom: 18,
          }}
        >
          Public, CC0, and methodologically transferable.
        </div>
        <div
          style={{
            fontSize: 20,
            color: theme.ink2,
            lineHeight: 1.45,
            marginBottom: 24,
          }}
        >
          Pettersen et al. 2022 · 251 colon biopsies · 10,569 patches · epithelium + CD3 masks.
        </div>

        <div
          style={{
            height: 200,
            backgroundColor: theme.accentSoft,
            borderRadius: 10,
            backgroundImage:
              "radial-gradient(circle at 22% 35%, rgba(184,144,47,0.55) 0 18px, transparent 19px), radial-gradient(circle at 65% 30%, rgba(61,139,94,0.50) 0 12px, transparent 13px), radial-gradient(circle at 40% 70%, rgba(184,144,47,0.50) 0 16px, transparent 17px), radial-gradient(circle at 80% 75%, rgba(61,139,94,0.45) 0 10px, transparent 11px)",
            backgroundSize: "150px 150px",
          }}
        />

        {/* CC0 stamp */}
        <div
          style={{
            position: "absolute",
            right: 32,
            top: 32,
            padding: "10px 18px",
            border: `3px solid ${theme.safe}`,
            color: theme.safe,
            fontFamily: theme.mono,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.1em",
            transform: `rotate(6deg) scale(${stampSpring})`,
            transformOrigin: "center",
            backgroundColor: "rgba(61,139,94,0.06)",
            textTransform: "uppercase",
          }}
        >
          CC0 · Public
        </div>
      </div>

      {/* Connecting arrow + quote */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <marker
            id="pivot-arrow"
            markerWidth="14"
            markerHeight="14"
            refX="10"
            refY="7"
            orient="auto"
          >
            <path d="M0,0 L12,7 L0,14 Z" fill={theme.accent} />
          </marker>
        </defs>
        <line
          x1={800}
          x2={800 + 320 * arrow}
          y1={540}
          y2={540}
          stroke={theme.accent}
          strokeWidth={5}
          strokeDasharray="0"
          markerEnd={arrow > 0.95 ? "url(#pivot-arrow)" : undefined}
        />
      </svg>

      {/* Quote ribbon at the bottom */}
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          bottom: 80,
          padding: "26px 34px",
          backgroundColor: theme.ink,
          color: theme.cream,
          borderRadius: 14,
          fontFamily: theme.serif,
          fontSize: 30,
          lineHeight: 1.35,
          opacity: quoteOp,
        }}
      >
        <span style={{ color: theme.accentBright, marginRight: 12, fontSize: 56, lineHeight: 0 }}>
          “
        </span>
        like celiac disease ... quantification of IEL is part of the pathologist's job.
        <span style={{ color: theme.accentBright, marginLeft: 12, fontSize: 56, lineHeight: 0 }}>
          ”
        </span>
        <div
          style={{
            marginTop: 12,
            fontFamily: theme.sans,
            fontSize: 18,
            color: theme.wheatLight,
            opacity: citationOp,
          }}
        >
          — Pettersen et al., IBDColEpi authors · DOI 10.18710/TLA01U
        </div>
      </div>
    </AbsoluteFill>
  );
};
