import { useEffect, useRef, useState } from 'react';

import { useReducedMotion, type Palette, type TypographyVariant } from '@/src/theme';
import { Text } from './Text';

type Props = {
  value: number;
  // Turns the animating number into its display string (e.g. a duration
  // or a percentage). Defaults to a rounded integer.
  format?: (n: number) => string;
  variant?: TypographyVariant;
  color?: keyof Palette;
  center?: boolean;
};

// A number that counts up to its value when it changes, so a key figure
// arrives with a little life rather than just appearing. Driven on the JS
// thread with requestAnimationFrame, which is plenty for short counts and
// keeps the formatter as an ordinary function. Honours reduce motion.
export function AnimatedNumber({
  value,
  format,
  variant,
  color,
  center,
}: Props) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = Date.now();
    const durationMs = 700;
    let frame: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  const fmt = format ?? ((n: number) => String(Math.round(n)));
  return (
    <Text variant={variant} color={color} center={center}>
      {fmt(display)}
    </Text>
  );
}
