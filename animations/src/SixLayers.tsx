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
 * SIX LAYERS — the disease twin's biological dimensions.
 *
 * Six labelled chips arranged in a 3x2 grid around a central Glüten mark.
 *
 * Beats:
 *   00–25f: centre pops in
 *   30–80f: chips stagger in (6 chips, ~8 frames apart)
 *   90–125f: connecting lines draw to centre
 *   135f:   subcaption
 */
export const SixLayers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const centerSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140 },
  });

  const chips = [
    { label: "Molecular", dataset: "GSE164883", angle: -150 },
    { label: "Structural", dataset: "IBDColEpi", angle: -90 },
    { label: "Clinical", dataset: "Kaggle CD", angle: -30 },
    { label: "Microbiome", dataset: "PRIDE PXD069517", angle: 30 },
    { label: "Longitudinal", dataset: "VDJdb 2025-12-29", angle: 90 },
    { label: "Genomic", dataset: "Abraham 2014 · 228 SNPs", angle: 150 },
  ];

  // Constellation geometry. Top chip must clear the title (~y=150),
  // bottom chip must clear the "Six public datasets..." subcap
  // (~y=1000). Centre y=600, radius=300 gives both ~50px breathing room.
  const cx = 960;
  const cy = 600;
  const radius = 300;

  const lineDraw = interpolate(frame, [90, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subcapOp = interpolate(frame, [135, 165], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
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
          top: 64,
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
          The disease twin
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            color: theme.ink,
            letterSpacing: "-0.02em",
          }}
        >
          Six layers. One query.
        </div>
      </div>

      {/* Connecting lines */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {chips.map((c, i) => {
          const a = (c.angle * Math.PI) / 180;
          const x2 = cx + Math.cos(a) * radius;
          const y2 = cy + Math.sin(a) * radius;
          const xEnd = cx + Math.cos(a) * (radius * lineDraw);
          const yEnd = cy + Math.sin(a) * (radius * lineDraw);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={xEnd}
              y2={yEnd}
              stroke={theme.accent}
              strokeWidth={2}
              opacity={0.45}
            />
          );
        })}
      </svg>

      {/* Centre Glüten mark */}
      <div
        style={{
          position: "absolute",
          left: cx - 90,
          top: cy - 90,
          width: 180,
          height: 180,
          borderRadius: "50%",
          backgroundColor: theme.ink,
          color: theme.accentBright,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: theme.serif,
          fontSize: 64,
          transform: `scale(${centerSpring})`,
          boxShadow: "0 18px 50px rgba(212,168,67,0.25)",
        }}
      >
        Glü
      </div>

      {/* Chips */}
      {chips.map((c, i) => {
        const a = (c.angle * Math.PI) / 180;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        const chipSpring = spring({
          frame: frame - (30 + i * 8),
          fps,
          config: { damping: 16, stiffness: 130 },
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 170,
              top: y - 50,
              width: 340,
              padding: "18px 24px",
              backgroundColor: theme.bg2,
              border: `2px solid ${theme.accent}`,
              borderRadius: 14,
              textAlign: "center",
              transform: `scale(${chipSpring})`,
              transformOrigin: "center",
              boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 32,
                color: theme.ink,
                lineHeight: 1.1,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 16,
                color: theme.muted,
                marginTop: 4,
              }}
            >
              {c.dataset}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 56,
          textAlign: "center",
          fontSize: 22,
          color: theme.muted,
          opacity: subcapOp,
        }}
      >
        Six public datasets, one composite model of coeliac disease.
      </div>
    </AbsoluteFill>
  );
};
