"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Reduced-motion flag that is `false` during SSR and hydration, then follows
 * the user preference. Prevents style-attribute hydration mismatches when a
 * component switches motion styles on/off based on the preference.
 */
export function useStableReducedMotion() {
  const pref = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && pref === true;
}
