import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { theme } from "./theme";

/**
 * CONFIDENCE FLAG — per-layer confidence breakdown for an under-represented profile.
 *
 * Six bars, one per layer. Four high, two near-zero (microbiome + longitudinal).
 * The visual point: most of the prediction is supported, but two layers are
 * empty for THIS patient. That's the equity finding made measurable.
 *
 * Beats:
 *   00–20f: title
 *   30f+:   bars fill, staggered
 *   140f:   "low-confidence" annotation appears
 *   165f:   demographic chip
 */
export const ConfidenceFlag: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const layers = [
    { name: "Molecular", value: 0.72, color: theme.accent },
    { name: "Structural", value: 0.85, color: theme.accent },
    { name: "Clinical", value: 0.61, color: theme.accent },
    { name: "Microbiome", value: 0.08, color: theme.alert },
    { name: "Longitudinal", value: 0.14, color: theme.alert },
    { name: "Genomic", value: 0.32, color: theme.wheatDeep },
  ];

  // Narrower chart so the right-margin callout has its own dedicated
  // column and never lands on top of the bars or the % labels.
  // Previously barMaxW=1100, callout overlapped Microbiome/Longitudinal.
  const barMaxW = 820;
  const barH = 48;
  const xLabel = 380;
  const xBar = 400;
  const startY = 280;
  const rowGap = 78;

  const annotOp = interpolate(frame, [140, 165], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chipOp = interpolate(frame, [165, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
        color: theme.ink,
        padding: 80,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.accent,
          backgroundColor: theme.accentSoft,
          padding: "10px 22px",
          borderRadius: 999,
          alignSelf: "flex-start",
          opacity: titleOp,
          display: "inline-block",
          width: "fit-content",
        }}
      >
        Per-layer confidence
      </div>

      <div
        style={{
          marginTop: 22,
          fontFamily: theme.serif,
          fontSize: 60,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          maxWidth: 1500,
          color: theme.ink,
          opacity: titleOp,
        }}
      >
        Which parts of the prediction were <em style={{ color: theme.accent, fontStyle: "italic" }}>built for this patient?</em>
      </div>

      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {layers.map((l, i) => {
          const y = startY + i * rowGap;
          const growStart = 30 + i * 10;
          const growEnd = growStart + 22;
          const grow = interpolate(frame, [growStart, growEnd], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const w = barMaxW * l.value * grow;
          const isLow = l.value < 0.2;
          return (
            <g key={l.name}>
              {/* Label */}
              <text
                x={xLabel}
                y={y + barH / 2 + 10}
                textAnchor="end"
                fill={theme.ink}
                fontFamily={theme.sans}
                fontSize={26}
                fontWeight={500}
              >
                {l.name}
              </text>

              {/* Background track */}
              <rect
                x={xBar}
                y={y}
                width={barMaxW}
                height={barH}
                fill={theme.line}
                rx={6}
              />

              {/* Filled portion */}
              <rect
                x={xBar}
                y={y}
                width={w}
                height={barH}
                fill={l.color}
                rx={6}
              />

              {/* Percentage label */}
              <text
                x={xBar + barMaxW + 18}
                y={y + barH / 2 + 10}
                fill={isLow ? theme.alert : theme.ink}
                fontFamily={theme.serif}
                fontSize={32}
                fontVariantNumeric="tabular-nums"
                fontWeight={isLow ? 600 : 400}
              >
                {Math.round(l.value * 100 * grow)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Annotation for the empty layers — pinned in the right column,
          centred vertically against the Microbiome+Longitudinal pair. */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: startY + rowGap * 3,
          width: 360,
          padding: "18px 22px",
          backgroundColor: "rgba(201,68,50,0.06)",
          border: `2px solid ${theme.alert}`,
          borderRadius: 12,
          opacity: annotOp,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: theme.alert,
            marginBottom: 8,
          }}
        >
          No data for this patient
        </div>
        <div style={{ fontSize: 20, color: theme.ink, lineHeight: 1.35 }}>
          Microbiome (PRIDE) and longitudinal (VDJdb) layers carry near-zero samples matching this demographic.
        </div>
      </div>

      {/* Demographic chip */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 90,
          padding: "14px 22px",
          backgroundColor: theme.ink,
          color: theme.cream,
          borderRadius: 999,
          fontSize: 22,
          opacity: chipOp,
        }}
      >
        Patient profile: African · female · 28
      </div>

      <div
        style={{
          position: "absolute",
          right: 90,
          bottom: 50,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.muted,
          opacity: chipOp,
        }}
      >
        Confidence computed deterministically, outside the LLM path.
      </div>
    </AbsoluteFill>
  );
};
