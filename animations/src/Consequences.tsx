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
 * CONSEQUENCES — what untreated coeliac actually does.
 *
 * Plays under the voiceover beat:
 * "Untreated coeliac doubles lymphoma risk, accelerates bone density
 *  loss, links to infertility and recurrent miscarriage. Every year of
 *  the 6-to-10 year delay compounds."
 *
 * Four clinical fact cards in a 2x2 grid, each with a big serif stat
 * and a short clinical caption. Cards spring in one by one. Closes on
 * a centred "Every year compounds." line + source.
 *
 * No fades-up. Spring scale + opacity only.
 *
 * Total: 210 frames = 7.0 s @ 30 fps.
 */

type Stat = {
  number: string;
  unit?: string;
  body: string;
  ref: string;
  colour: string;
};

const STATS: Stat[] = [
  {
    number: "2–4",
    unit: "×",
    body: "lymphoma risk",
    ref: "non-Hodgkin, EATL",
    colour: theme.alert,
  },
  {
    number: "2",
    unit: "×",
    body: "fracture risk",
    ref: "low bone density common",
    colour: theme.wheatDeep,
  },
  {
    number: "4–8",
    unit: "%",
    body: "of unexplained infertility",
    ref: "tests CD-positive",
    colour: theme.alert,
  },
  {
    number: "6",
    unit: "×",
    body: "recurrent miscarriage",
    ref: "vs general population",
    colour: theme.wheatDeep,
  },
];

export const Consequences: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card positions (2x2 grid)
  const cardW = 720;
  const cardH = 260;
  const gapX = 60;
  const gapY = 36;
  const gridW = cardW * 2 + gapX;
  const gridX = (1920 - gridW) / 2;
  const gridY = 280;

  const positions = [
    { x: gridX,             y: gridY },                    // top-left
    { x: gridX + cardW + gapX, y: gridY },                 // top-right
    { x: gridX,             y: gridY + cardH + gapY },     // bottom-left
    { x: gridX + cardW + gapX, y: gridY + cardH + gapY },  // bottom-right
  ];

  // Each card appears starting at: 20 + i*16
  // Cards 0..3 land at frames 20..68 ish

  const closingOp = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sourceOp = interpolate(frame, [140, 165], [0, 1], {
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
      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: 180,
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
            color: theme.alert,
            backgroundColor: "rgba(201,68,50,0.10)",
            padding: "10px 22px",
            borderRadius: 999,
          }}
        >
          Untreated coeliac, over time
        </span>
      </div>

      {/* Cards */}
      {STATS.map((s, i) => {
        const pos = positions[i];
        const localFrame = frame - (20 + i * 16);
        const scale = spring({
          frame: localFrame,
          fps,
          config: { damping: 14, stiffness: 150 },
        });
        const opacity = interpolate(localFrame, [0, 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: cardW,
              height: cardH,
              backgroundColor: theme.bg2,
              border: `2px solid ${s.colour}`,
              borderRadius: 18,
              padding: "32px 40px",
              display: "flex",
              alignItems: "center",
              gap: 32,
              transform: `scale(${Math.max(0, scale)})`,
              transformOrigin: "center",
              opacity,
              boxShadow: "0 14px 32px rgba(0,0,0,0.05)",
            }}
          >
            {/* Big serif number */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontFamily: theme.serif,
                color: s.colour,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                minWidth: 240,
              }}
            >
              <span style={{ fontSize: 140 }}>{s.number}</span>
              {s.unit && (
                <span style={{ fontSize: 100, marginLeft: 6 }}>{s.unit}</span>
              )}
            </div>
            {/* Caption */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: theme.serif,
                  fontSize: 36,
                  color: theme.ink,
                  lineHeight: 1.15,
                }}
              >
                {s.body}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: theme.mono,
                  fontSize: 17,
                  color: theme.muted,
                  letterSpacing: "0.04em",
                }}
              >
                {s.ref}
              </div>
            </div>
          </div>
        );
      })}

      {/* Closing line */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: theme.serif,
          fontSize: 44,
          color: theme.ink,
          opacity: closingOp,
          letterSpacing: "-0.01em",
        }}
      >
        Every year of the delay <em style={{ color: theme.alert, fontStyle: "italic" }}>compounds.</em>
      </div>

      {/* Source */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.muted,
          opacity: sourceOp,
          letterSpacing: "0.05em",
        }}
      >
        Mearns et al. 2019 · Larussa et al. 2012 · Sher et al. 2007 · Tursi et al. 2010
      </div>
    </AbsoluteFill>
  );
};
