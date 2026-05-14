"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const layers = [
  { label: "Molecular", angle: 0 },
  { label: "Structural", angle: 60 },
  { label: "Clinical", angle: 120 },
  { label: "Microbiome", angle: 180 },
  { label: "Longitudinal", angle: 240 },
  { label: "Genomic", angle: 300 },
];

// A pair of sinusoidal strands that form a DNA double-helix when
// stacked with their rungs. Values are pre-computed so the SVG stays
// crisp at any size.
const helixPoints = Array.from({ length: 22 }, (_, i) => {
  const t = i / 21;
  const y = t * 280 + 10;
  const phase = t * Math.PI * 4;
  return {
    y,
    x1: 150 + Math.sin(phase) * 48,
    x2: 150 - Math.sin(phase) * 48,
  };
});

export default function HeroVisual() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="relative mx-auto aspect-square w-full max-w-[520px]" />;
  }
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      {/* soft gold glow */}
      <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(212,168,67,0.35),transparent_65%)] blur-2xl" />

      {/* outer orbit ring */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, ease: "linear", repeat: Infinity }}
      >
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <circle
            cx="200"
            cy="200"
            r="186"
            fill="none"
            stroke="url(#ring)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
          {layers.map((l) => {
            const rad = (l.angle * Math.PI) / 180;
            const cx = 200 + Math.cos(rad) * 186;
            const cy = 200 + Math.sin(rad) * 186;
            return (
              <g key={l.label}>
                <circle cx={cx} cy={cy} r="4" fill="#D4A843" />
                <circle cx={cx} cy={cy} r="10" fill="#D4A843" fillOpacity="0.15" />
              </g>
            );
          })}
        </svg>
      </motion.div>

      {/* middle orbit ring, opposite direction, faster */}
      <motion.div
        className="absolute inset-10"
        animate={{ rotate: -360 }}
        transition={{ duration: 40, ease: "linear", repeat: Infinity }}
      >
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            stroke="#2D2A24"
            strokeOpacity="0.15"
            strokeWidth="1"
          />
          <circle cx="200" cy="50" r="3" fill="#2D2A24" fillOpacity="0.6" />
          <circle cx="350" cy="200" r="3" fill="#2D2A24" fillOpacity="0.6" />
          <circle cx="200" cy="350" r="3" fill="#2D2A24" fillOpacity="0.6" />
          <circle cx="50" cy="200" r="3" fill="#2D2A24" fillOpacity="0.6" />
        </svg>
      </motion.div>

      {/* central DNA helix, gently pulsing */}
      <motion.div
        className="absolute inset-[22%] flex items-center justify-center"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
      >
        <svg viewBox="0 0 300 300" className="h-full w-full">
          <defs>
            <linearGradient id="strand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8902F" />
              <stop offset="100%" stopColor="#D4A843" />
            </linearGradient>
          </defs>

          {/* rungs */}
          {helixPoints.map((p, i) => {
            const near = Math.abs(p.x1 - p.x2) < 20;
            return (
              <line
                key={`r${i}`}
                x1={p.x1}
                y1={p.y}
                x2={p.x2}
                y2={p.y}
                stroke="#2D2A24"
                strokeOpacity={near ? 0.15 : 0.55}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* strand A */}
          <motion.polyline
            points={helixPoints.map((p) => `${p.x1},${p.y}`).join(" ")}
            fill="none"
            stroke="url(#strand)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.4, ease: "easeOut" }}
          />
          {/* strand B */}
          <motion.polyline
            points={helixPoints.map((p) => `${p.x2},${p.y}`).join(" ")}
            fill="none"
            stroke="#2D2A24"
            strokeOpacity="0.85"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.4, ease: "easeOut", delay: 0.2 }}
          />
          {/* base nodes */}
          {helixPoints.map((p, i) => (
            <g key={`n${i}`}>
              <circle cx={p.x1} cy={p.y} r="3" fill="#D4A843" />
              <circle cx={p.x2} cy={p.y} r="3" fill="#2D2A24" />
            </g>
          ))}
        </svg>
      </motion.div>
    </div>
  );
}
