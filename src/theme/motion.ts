import { Easing } from 'react-native-reanimated';

// Shared motion language. Premium motion is consistent and calm: a small
// set of durations and easings used everywhere, rather than ad-hoc values.
export const motion = {
  duration: {
    fast: 180,
    base: 320,
    slow: 480,
    // A relaxed breath, for ambient pulses.
    breath: 4200,
  },
  easing: {
    // Decelerate into place: the default for things arriving.
    standard: Easing.out(Easing.cubic),
    // Soft on both ends: for looping, ambient motion.
    gentle: Easing.inOut(Easing.ease),
  },
} as const;

// Honour the OS "reduce motion" setting. Re-exported so components reach
// for it from the theme alongside the motion tokens.
export { useReducedMotion } from 'react-native-reanimated';
