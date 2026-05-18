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
 * FLYWHEEL — the four-stage coeliac care loop.
 *
 * Plays under "the two modes create a complete coeliac disease testing
 * flywheel" voiceover. Four nodes around a central Glüten mark:
 *
 *     ┌──────── Screen (catch the invisible 70%)
 *     │
 *     └─────▶ Test (demographic-aware advisory)
 *               │
 *               └────▶ Twin (six-layer projection + confidence)
 *                         │
 *                         └────▶ Contribute (grows the model)
 *                                       │
 *                                       └────▶ (back to Screen, better)
 *
 * Beats (no translateY):
 *   00–18f: centre mark spring-in
 *   20–95f: nodes appear one by one (20f apart)
 *   95–155f: curved arrows draw between them
 *   155f+:  momentum dashes pulse around the perimeter
 *
 * Total: 180 frames = 6.0 s @ 30 fps.
 */
export const Flywheel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Push the constellation down so the top "Screen" card clears the
  // title block (title ends around y=230, top card now starts around
  // y=265).
  const cx = 960;
  const cy = 620;
  const radius = 270;

  // Centre Glüten mark
  const centreScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140 },
  });

  // Four nodes — clockwise from top
  const nodes = [
    {
      label: "Screen",
      sub: "catch the invisible 70%",
      stat: "1 in 100 globally",
      colour: theme.info,
      angle: -90,
      startFrame: 20,
    },
    {
      label: "Test",
      sub: "demographic-aware advisory",
      stat: "tTG-IgA bias · PMC11308727",
      colour: theme.accent,
      angle: 0,
      startFrame: 40,
    },
    {
      label: "Twin",
      sub: "six-layer projection",
      stat: "395 PubMed abstracts · F1 0.83",
      colour: theme.wheatDeep,
      angle: 90,
      startFrame: 60,
    },
    {
      label: "Contribute",
      sub: "grows the model",
      stat: "each profile improves the next",
      colour: theme.safe,
      angle: 180,
      startFrame: 80,
    },
  ];

  // Title at top
  const titleOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Momentum dashes pulse near the end
  const momentumPulse = (frame % 30) / 30;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
        color: theme.ink,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
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
          The Glüten flywheel
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 52,
            color: theme.ink,
            letterSpacing: "-0.02em",
          }}
        >
          One loop. Every patient improves the next.
        </div>
      </div>

      {/* Connector arcs between nodes (full circle), draws in over time */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <marker
            id="fw-arrow"
            markerWidth="14"
            markerHeight="14"
            refX="10"
            refY="7"
            orient="auto"
          >
            <path d="M0,0 L12,7 L0,14 Z" fill={theme.accent} />
          </marker>
        </defs>

        {/* Big background ring — draws clockwise as the nodes appear */}
        {[0, 1, 2, 3].map((i) => {
          const start = nodes[i];
          const end = nodes[(i + 1) % 4];
          const a1 = (start.angle * Math.PI) / 180;
          const a2 = (end.angle * Math.PI) / 180;
          // Mid-arc node positions
          const x1 = cx + Math.cos(a1) * radius;
          const y1 = cy + Math.sin(a1) * radius;
          const x2 = cx + Math.cos(a2) * radius;
          const y2 = cy + Math.sin(a2) * radius;
          // SVG arc path
          const arcFrame = 95 + i * 15;
          const arcProgress = interpolate(frame, [arcFrame, arcFrame + 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // Use stroke-dasharray to "draw" the path
          const pathLen = (radius * Math.PI) / 2; // quarter circle
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={theme.accent}
              strokeWidth={4}
              strokeDasharray={pathLen}
              strokeDashoffset={pathLen * (1 - arcProgress)}
              opacity={0.6}
              markerEnd={arcProgress > 0.95 ? "url(#fw-arrow)" : undefined}
            />
          );
        })}

        {/* Momentum pulse dashes around the outside */}
        {frame > 155 && (
          <circle
            cx={cx}
            cy={cy}
            r={radius + 30}
            fill="none"
            stroke={theme.accent}
            strokeWidth={2}
            strokeDasharray="16 24"
            strokeDashoffset={-momentumPulse * 40}
            opacity={0.4}
          />
        )}
      </svg>

      {/* Centre Glüten mark */}
      <div
        style={{
          position: "absolute",
          left: cx - 80,
          top: cy - 80,
          width: 160,
          height: 160,
          borderRadius: "50%",
          backgroundColor: theme.ink,
          color: theme.accentBright,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: theme.serif,
          fontSize: 56,
          transform: `scale(${centreScale})`,
          boxShadow: "0 18px 50px rgba(212,168,67,0.25)",
        }}
      >
        Glü
      </div>

      {/* Four nodes */}
      {nodes.map((n) => {
        const a = (n.angle * Math.PI) / 180;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        const localFrame = frame - n.startFrame;
        const scale = spring({
          frame: localFrame,
          fps,
          config: { damping: 14, stiffness: 160 },
        });
        const opacity = interpolate(localFrame, [0, 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={n.label}
            style={{
              position: "absolute",
              left: x - 150,
              top: y - 85,
              width: 300,
              padding: "18px 22px",
              backgroundColor: theme.bg2,
              border: `3px solid ${n.colour}`,
              borderRadius: 18,
              textAlign: "center",
              transform: `scale(${Math.max(0, scale)})`,
              opacity,
              boxShadow: "0 14px 32px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 32,
                color: theme.ink,
                lineHeight: 1.0,
              }}
            >
              {n.label}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: theme.sans,
                fontSize: 14,
                color: theme.muted,
                lineHeight: 1.3,
              }}
            >
              {n.sub}
            </div>
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${theme.line}`,
                fontFamily: theme.mono,
                fontSize: 12,
                color: n.colour,
                letterSpacing: "0.04em",
                lineHeight: 1.3,
              }}
            >
              {n.stat}
            </div>
          </div>
        );
      })}

      {/* Subcaption bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.muted,
          opacity: interpolate(frame, [140, 165], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Early suspicion → screening → longitudinal modelling → research pool.
      </div>
    </AbsoluteFill>
  );
};
