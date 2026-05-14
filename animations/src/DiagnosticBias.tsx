import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { theme } from "./theme";

/**
 * DIAGNOSTIC BIAS — tTG-IgA false-negative rates by ethnicity.
 *
 * Two-bar chart: White patient cohort vs Black patient cohort.
 * The Black bar visibly drops below a dashed reference threshold.
 *
 * Citation: PMC11308727.
 *
 * Beats:
 *   00–25f: title + eyebrow
 *   30–80f: bars rise (staggered)
 *   90f:    threshold line draws
 *   110f:   "gap" annotation appears between bars
 *   140f:   citation fades
 */
export const DiagnosticBias: React.FC = () => {
  const frame = useCurrentFrame();

  const eyebrowOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleLift = interpolate(frame, [10, 35], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bars rise from 0 to target height
  const whiteBar = interpolate(frame, [30, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blackBar = interpolate(frame, [45, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineDraw = interpolate(frame, [90, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gapOp = interpolate(frame, [110, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const citationOp = interpolate(frame, [140, 165], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bar geometry
  const baseY = 880;
  const fullH = 540;
  const whiteH = fullH * 0.92 * whiteBar;
  const blackH = fullH * 0.58 * blackBar;
  const barW = 200;
  const xWhite = 660;
  const xBlack = 1060;
  const thresholdY = baseY - fullH * 0.75;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
        color: theme.ink,
        padding: 96,
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.alert,
          backgroundColor: "rgba(201,68,50,0.10)",
          padding: "10px 22px",
          borderRadius: 999,
          opacity: eyebrowOp,
        }}
      >
        The screening test is biased
      </div>

      <div
        style={{
          marginTop: 28,
          fontFamily: theme.serif,
          fontSize: 76,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          maxWidth: 1500,
          color: theme.ink,
          opacity: titleOp,
          transform: `translateY(${titleLift}px)`,
        }}
      >
        tTG-IgA sensitivity drops in <em style={{ color: theme.alert, fontStyle: "italic" }}>Black patients.</em>
      </div>

      {/* Chart area */}
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
        {/* Axis */}
        <line
          x1={520}
          x2={1380}
          y1={baseY}
          y2={baseY}
          stroke={theme.line}
          strokeWidth={3}
        />

        {/* Threshold dashed line. Starts past the caption so the label
            "clinical sensitivity threshold" sits flush LEFT of the line,
            on the same horizontal axis. The line is then visually
            interrupted by the White bar (which sits on top of it). */}
        <text
          x={620}
          y={thresholdY + 7}
          textAnchor="end"
          fill={theme.muted}
          fontFamily={theme.sans}
          fontSize={20}
          opacity={lineDraw}
        >
          clinical sensitivity threshold
        </text>
        <line
          x1={640}
          x2={640 + 620 * lineDraw}
          y1={thresholdY}
          y2={thresholdY}
          stroke={theme.muted}
          strokeWidth={3}
          strokeDasharray="14 10"
        />

        {/* White-patient bar */}
        <rect
          x={xWhite}
          y={baseY - whiteH}
          width={barW}
          height={whiteH}
          fill={theme.accent}
          rx={4}
        />
        <text
          x={xWhite + barW / 2}
          y={baseY + 40}
          textAnchor="middle"
          fill={theme.ink}
          fontFamily={theme.sans}
          fontSize={26}
          fontWeight={500}
        >
          White patients
        </text>
        <text
          x={xWhite + barW / 2}
          y={baseY - whiteH - 22}
          textAnchor="middle"
          fill={theme.ink}
          fontFamily={theme.serif}
          fontSize={42}
          opacity={whiteBar}
        >
          high sensitivity
        </text>

        {/* Black-patient bar */}
        <rect
          x={xBlack}
          y={baseY - blackH}
          width={barW}
          height={blackH}
          fill={theme.alert}
          rx={4}
        />
        <text
          x={xBlack + barW / 2}
          y={baseY + 40}
          textAnchor="middle"
          fill={theme.ink}
          fontFamily={theme.sans}
          fontSize={26}
          fontWeight={500}
        >
          Black patients
        </text>
        <text
          x={xBlack + barW / 2}
          y={baseY - blackH - 22}
          textAnchor="middle"
          fill={theme.alert}
          fontFamily={theme.serif}
          fontSize={42}
          opacity={blackBar}
        >
          false negatives
        </text>

        {/* Gap brace + annotation */}
        <g opacity={gapOp}>
          <line
            x1={xBlack + barW + 40}
            x2={xBlack + barW + 40}
            y1={baseY - whiteH}
            y2={baseY - blackH}
            stroke={theme.alert}
            strokeWidth={3}
          />
          <line
            x1={xBlack + barW + 32}
            x2={xBlack + barW + 48}
            y1={baseY - whiteH}
            y2={baseY - whiteH}
            stroke={theme.alert}
            strokeWidth={3}
          />
          <line
            x1={xBlack + barW + 32}
            x2={xBlack + barW + 48}
            y1={baseY - blackH}
            y2={baseY - blackH}
            stroke={theme.alert}
            strokeWidth={3}
          />
          <text
            x={xBlack + barW + 70}
            y={baseY - (whiteH + blackH) / 2 + 12}
            fill={theme.alert}
            fontFamily={theme.serif}
            fontSize={38}
            fontStyle="italic"
          >
            the gap
          </text>
        </g>
      </svg>

      {/* Citation pinned bottom-right */}
      <div
        style={{
          position: "absolute",
          right: 96,
          bottom: 64,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.muted,
          opacity: citationOp,
        }}
      >
        Source: PMC11308727
      </div>
    </AbsoluteFill>
  );
};
