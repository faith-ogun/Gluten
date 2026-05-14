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
 * ONE IN ONE — prevalence + invisibility hook.
 *
 * "1 in 100 globally. 70% never diagnosed."
 *
 * Beats:
 *   00–18f: eyebrow fades in
 *   18–32f: "1 in" fades in
 *   25f+:   "100" counts up 0 → 100 (spring)
 *   60–85f: caption "people, globally" fades up
 *   95f:    divider draws
 *   115f+:  "70" counts up 0 → 70 (spring)
 *   145–170f: subcap "are never diagnosed."
 *   175f+:  source fades in
 *
 * Layout: hard-coded top offset, no flex centring. Counts down from
 * top y=140 → fits comfortably in the 1080-frame with the source line
 * landing around y=1015.
 */
export const OneInOne: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const oneInOp = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "100" counts up from 0 — spring-paced.
  const hundredProgress = spring({
    frame: frame - 25,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  });
  const hundredCount = Math.round(
    100 * Math.max(0, Math.min(1, hundredProgress)),
  );

  const captionOp = interpolate(frame, [60, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dividerScale = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "70" counts up — same pattern as "100".
  const seventyProgress = spring({
    frame: frame - 115,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  });
  const seventyCount = Math.round(
    70 * Math.max(0, Math.min(1, seventyProgress)),
  );
  const pctScale = spring({
    frame: frame - 140,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const subcapOp = interpolate(frame, [145, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sourceOp = interpolate(frame, [175, 195], [0, 1], {
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
          top: 140,
          left: 96,
          right: 96,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Eyebrow */}
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
            marginBottom: 40,
            opacity: eyebrowOp,
          }}
        >
          The invisible 70%
        </div>

        {/* "1 in 100" — bigger, no lift, "100" counts up */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 36,
            fontFamily: theme.serif,
            lineHeight: 1.0,
          }}
        >
          <span
            style={{
              fontSize: 320,
              color: theme.ink,
              letterSpacing: "-0.04em",
              opacity: oneInOp,
              display: "inline-block",
            }}
          >
            1
          </span>
          <span
            style={{
              fontSize: 96,
              color: theme.muted,
              fontStyle: "italic",
              opacity: oneInOp,
              display: "inline-block",
              fontWeight: 400,
            }}
          >
            in
          </span>
          <span
            style={{
              fontSize: 320,
              color: theme.accent,
              letterSpacing: "-0.04em",
              display: "inline-block",
              fontVariantNumeric: "tabular-nums",
              minWidth: "1.5em",
            }}
          >
            {hundredCount}
          </span>
        </div>

        {/* Caption */}
        <div
          style={{
            marginTop: 22,
            fontSize: 40,
            color: theme.ink,
            maxWidth: 1200,
            opacity: captionOp,
            fontWeight: 500,
          }}
        >
          people have coeliac disease, globally.
        </div>

        {/* Divider */}
        <div
          style={{
            marginTop: 32,
            marginBottom: 32,
            height: 4,
            width: 320,
            backgroundColor: theme.accent,
            borderRadius: 2,
            transform: `scaleX(${dividerScale})`,
            transformOrigin: "left center",
          }}
        />

        {/* "70%" — bigger, counts up */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            fontFamily: theme.serif,
            lineHeight: 0.95,
          }}
        >
          <span
            style={{
              fontSize: 260,
              color: theme.alert,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {seventyCount}
          </span>
          <span
            style={{
              fontSize: 180,
              color: theme.alert,
              transform: `scale(${pctScale})`,
              transformOrigin: "left bottom",
              display: "inline-block",
            }}
          >
            %
          </span>
        </div>

        {/* Subcap */}
        <div
          style={{
            marginTop: 18,
            fontSize: 40,
            color: theme.ink,
            maxWidth: 1200,
            opacity: subcapOp,
            fontWeight: 500,
          }}
        >
          are <em style={{ color: theme.alert, fontStyle: "italic" }}>never diagnosed.</em>
        </div>

        {/* Source */}
        <div
          style={{
            marginTop: 28,
            fontSize: 20,
            color: theme.muted,
            opacity: sourceOp,
          }}
        >
          Catassi et al., The Lancet 2022 · Her.ie 2024
        </div>
      </div>
    </AbsoluteFill>
  );
};
