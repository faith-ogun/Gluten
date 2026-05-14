import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { theme } from "./theme";

/**
 * RESEARCH VOID — PubMed literature distribution.
 *
 * Three horizontal bars stacked vertically:
 *   Total CD papers:       ~32,725
 *   European-focused:       ~3,400
 *   African-focused:          ~274     (a sliver; <1%)
 *
 * Beats:
 *   00–20f: eyebrow + title
 *   30–55f: total bar grows
 *   60–85f: European bar grows
 *   90–115f: African bar grows
 *   125f:   "<1%" annotation pops on African bar
 *   145f:   source line
 */
export const ResearchVoid: React.FC = () => {
  const frame = useCurrentFrame();

  const eyebrowOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [8, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const totalBar = interpolate(frame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const euBar = interpolate(frame, [60, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const afBar = interpolate(frame, [90, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const annotPop = interpolate(frame, [125, 145], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sourceOp = interpolate(frame, [145, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scale so that total fills ~1100 px and African ~9 px (truly a sliver)
  const maxW = 1100;
  const total = 32725;
  const eu = 3400;
  const af = 274;
  const wTotal = maxW * totalBar;
  const wEu = (eu / total) * maxW * euBar;
  const wAf = (af / total) * maxW * afBar;

  const Row = ({
    label,
    width,
    color,
    n,
    y,
  }: {
    label: string;
    width: number;
    color: string;
    n: string;
    y: number;
  }) => (
    <g>
      <text
        x={300}
        y={y + 38}
        fill={theme.ink}
        fontFamily={theme.sans}
        fontSize={28}
        fontWeight={500}
        textAnchor="end"
      >
        {label}
      </text>
      <rect x={330} y={y} width={width} height={60} fill={color} rx={4} />
      <text
        x={330 + width + 20}
        y={y + 42}
        fill={theme.ink}
        fontFamily={theme.serif}
        fontSize={36}
        fontVariantNumeric="tabular-nums"
      >
        {n}
      </text>
    </g>
  );

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
          color: theme.accent,
          backgroundColor: theme.accentSoft,
          padding: "10px 22px",
          borderRadius: 999,
          opacity: eyebrowOp,
        }}
      >
        The research is missing
      </div>

      <div
        style={{
          marginTop: 28,
          fontFamily: theme.serif,
          fontSize: 64,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          maxWidth: 1500,
          color: theme.ink,
          opacity: titleOp,
        }}
      >
        Coeliac disease in PubMed.
      </div>

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
        <Row
          label="All papers"
          width={wTotal}
          color={theme.accent}
          n="32,725"
          y={420}
        />
        <Row
          label="European cohorts"
          width={wEu}
          color={theme.wheatDeep}
          n="3,400"
          y={540}
        />
        <Row
          label="African cohorts"
          width={Math.max(wAf, 4 * afBar)}
          color={theme.alert}
          n="274"
          y={660}
        />

        {/* <1% annotation */}
        <g opacity={annotPop}>
          <line
            x1={360}
            x2={500}
            y1={780}
            y2={780}
            stroke={theme.alert}
            strokeWidth={3}
          />
          <text
            x={520}
            y={790}
            fill={theme.alert}
            fontFamily={theme.serif}
            fontSize={56}
            fontStyle="italic"
          >
            less than 1% of the literature.
          </text>
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          right: 96,
          bottom: 64,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.muted,
          opacity: sourceOp,
        }}
      >
        PubMed search, April 2026
      </div>
    </AbsoluteFill>
  );
};
