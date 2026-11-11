"use client";

import { MotionConfig, motion } from "framer-motion";
import type { ReactNode } from "react";
import { DURATION, EASE, VIEWPORT } from "@/lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "article" | "header" | "p";
};

/**
 * Fade + rise into view once. Under reduced motion, MotionConfig reducedMotion="user"
 * drops the rise and keeps the fade; markup is identical on server and client.
 */
export function Reveal({ children, className, delay = 0, y = 28, as = "div" }: RevealProps) {
  const Tag = motion[as];
  return (
    <MotionConfig reducedMotion="user">
      <Tag
        className={className}
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: DURATION.slow, ease: EASE.cinematic, delay }}
      >
        {children}
      </Tag>
    </MotionConfig>
  );
}
