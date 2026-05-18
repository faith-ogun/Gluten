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
 * DIAGNOSTIC DELAY — "Average diagnostic delay: 6 to 10 years."
 *
 * A real clinical timeline: 11 year-dots (year 0 through year 10) snap
 * in one by one. Once we hit year 6, a red "delay zone" lights up
 * across years 6-10 with a "diagnosis lands here" label. The big serif
 * stat reads under it.
 *
 * No translateY animations. Only opacity, scaleX, and spring scale on
 * the dots.
 *
 * Total: 150 frames = 5.0 s @ 30 fps.
 */
export const DiagnosticDelay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Timeline geometry
  const cx = 960;
  const timelineW = 1200;
  const xStart = cx - timelineW / 2;
  const xEnd = cx + timelineW / 2;
  const timelineY = 440;
  const tickStep = timelineW / 10;
  // 11 dots, years 0..10
  // Each dot snaps in at frame 20 + i*7
  // So year 6 lands at frame 20 + 42 = 62
  // Year 10 lands at frame 20 + 70 = 90

  const lineDraw = interpolate(frame, [18, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red zone band fade in once year 6 has landed (~frame 65)
  const zoneOp = interpolate(frame, [65, 90], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Big serif "6 to 10 years" fades in after the zone
  const statOp = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Caption + source last
  const captionOp = interpolate(frame, [115, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sourceOp = interpolate(frame, [130, 145], [0, 1], {
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
      {/* Eyebrow centred at top */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: eyebrowOp,
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.accent,
            backgroundColor: theme.accentSoft,
            padding: "10px 22px",
            borderRadius: 999,
          }}
        >
          Average diagnostic delay
        </span>
      </div>

      {/* Timeline SVG */}
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
        {/* Red delay zone band */}
        <rect
          x={xStart + tickStep * 6 - 14}
          y={timelineY - 38}
          width={tickStep * 4 + 28}
          height={76}
          rx={38}
          fill={theme.alert}
          opacity={zoneOp * 0.18}
        />
        {/* Red zone border */}
        <rect
          x={xStart + tickStep * 6 - 14}
          y={timelineY - 38}
          width={tickStep * 4 + 28}
          height={76}
          rx={38}
          fill="none"
          stroke={theme.alert}
          strokeWidth={2}
          opacity={zoneOp}
        />

        {/* Backbone line */}
        <line
          x1={xStart}
          x2={xStart + timelineW * lineDraw}
          y1={timelineY}
          y2={timelineY}
          stroke={theme.line}
          strokeWidth={3}
        />

        {/* 11 year dots */}
        {Array.from({ length: 11 }).map((_, i) => {
          const dotFrame = frame - (20 + i * 7);
          const dotScale = spring({
            frame: dotFrame,
            fps,
            config: { damping: 14, stiffness: 180 },
          });
          const dotX = xStart + i * tickStep;
          const inZone = i >= 6;
          const fill = inZone ? theme.alert : theme.accent;
          const r = inZone ? 18 : 14;
          return (
            <g key={i}>
              <circle
                cx={dotX}
                cy={timelineY}
                r={r * Math.max(0, dotScale)}
                fill={fill}
              />
              {/* Year number label below each dot */}
              <text
                x={dotX}
                y={timelineY + 60}
                textAnchor="middle"
                fontFamily={theme.mono}
                fontSize={20}
                fill={inZone ? theme.alert : theme.muted}
                opacity={dotScale}
                fontWeight={inZone ? 700 : 400}
              >
                {i}
              </text>
            </g>
          );
        })}

        {/* "year 0" / "year 10" caps */}
        <text
          x={xStart}
          y={timelineY - 60}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={18}
          fill={theme.muted}
          opacity={lineDraw}
          letterSpacing="0.1em"
        >
          SYMPTOMS START
        </text>
        <text
          x={xEnd - tickStep * 2}
          y={timelineY - 60}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={18}
          fill={theme.alert}
          opacity={zoneOp}
          letterSpacing="0.1em"
          fontWeight={600}
        >
          DIAGNOSIS LANDS HERE
        </text>
      </svg>

      {/* Big stat underneath the timeline */}
      <div
        style={{
          position: "absolute",
          top: 600,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: statOp,
        }}
      >
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 180,
            lineHeight: 1.0,
            color: theme.ink,
            letterSpacing: "-0.03em",
          }}
        >
          6 to <span style={{ color: theme.alert }}>10</span> years
        </div>
      </div>

      {/* Caption + source */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: captionOp,
          fontFamily: theme.serif,
          fontSize: 36,
          color: theme.ink,
        }}
      >
        from symptoms to a coeliac disease diagnosis.
      </div>

      <div
        style={{
          position: "absolute",
          top: 900,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: sourceOp,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.muted,
        }}
      >
        Catassi et al., The Lancet 2022
      </div>
    </AbsoluteFill>
  );
};
