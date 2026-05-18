import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "./theme";

/**
 * JOURNEY — personal medical-records collage.
 *
 * Plays under Faith's voiceover for the "I went years to my GP with low
 * iron, fatigue, brain fog, allergy panels, endoscopies" beat. Five of
 * her own medical images (allergy test, endoscopy prep, hospital, etc.)
 * appear one by one, polaroid-style, slightly rotated and offset, on a
 * cream background.
 *
 * No fade-ups (translateY). Only spring scale-in + opacity + steady
 * rotation. Each image gets a thin paper border so it reads as a
 * physical photograph rather than a UI element.
 *
 * Total: 165 frames = 5.5 s @ 30 fps.
 */

type Card = {
  src: string;
  x: number; // center x
  y: number; // center y
  rotation: number; // deg
  width: number;
  height: number;
  startFrame: number;
};

const CARDS: Card[] = [
  // Layered like photos thrown on a desk, sized to fill the frame.
  // Centre card biggest, edge cards still substantial.
  { src: "journey-1.jpeg", x: 330,  y: 560, rotation: -8,  width: 460, height: 600, startFrame: 0 },
  { src: "journey-2.jpeg", x: 720,  y: 340, rotation: 5,   width: 440, height: 560, startFrame: 12 },
  { src: "journey-3.jpeg", x: 960,  y: 580, rotation: -2,  width: 520, height: 660, startFrame: 24 },
  { src: "journey-4.jpeg", x: 1240, y: 360, rotation: 7,   width: 440, height: 580, startFrame: 36 },
  { src: "journey-5.jpeg", x: 1600, y: 600, rotation: -6,  width: 460, height: 600, startFrame: 48 },
];

export const Journey: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.sans,
      }}
    >
      {/* Subtle background texture: a soft gold wash on one corner so the
          composition has visual weight without competing with the cards. */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          left: -300,
          top: -300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.wheatLight} 0%, transparent 70%)`,
          opacity: 0.35,
        }}
      />

      {CARDS.map((card, i) => {
        const localFrame = frame - card.startFrame;
        const scale = spring({
          frame: localFrame,
          fps,
          config: { damping: 14, stiffness: 130, mass: 0.9 },
        });
        const opacity = interpolate(localFrame, [0, 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: card.x - card.width / 2,
              top: card.y - card.height / 2,
              width: card.width,
              height: card.height,
              transform: `rotate(${card.rotation}deg) scale(${Math.max(0, scale)})`,
              opacity,
              backgroundColor: "white",
              padding: 14,
              paddingBottom: 28,
              boxShadow:
                "0 14px 32px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.10)",
              borderRadius: 4,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staticFile(card.src)}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        );
      })}

    </AbsoluteFill>
  );
};
