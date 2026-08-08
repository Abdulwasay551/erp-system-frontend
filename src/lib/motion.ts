import type { Transition, Variants } from "framer-motion";

/** Shared timing/easing so Framer Motion animations read as one system across pages -
 * mirrors mobile/lib/theme/app_motion.dart's constants (350ms entrance, 60ms stagger
 * step, ease-out) so both apps feel like the same product in motion, not just color. */
export const ENTRANCE_DURATION = 0.35;
export const STAGGER_STEP = 0.06;
export const ENTRANCE_EASE: Transition["ease"] = [0.16, 1, 0.3, 1]; // ease-out-ish

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: ENTRANCE_DURATION, ease: ENTRANCE_EASE } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER_STEP },
  },
};
