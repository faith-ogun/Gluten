"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

type Props = HTMLMotionProps<"div"> & { children: ReactNode; delay?: number };

export default function Reveal({ children, delay = 0, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
