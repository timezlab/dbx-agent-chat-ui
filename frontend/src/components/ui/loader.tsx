"use client";

import * as React from "react";
import { motion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * LoaderOne — three dots riding a continuous vertical wave (Aceternity UI, adapted).
 * Each dot repeats the same 0→up→0 bounce, staggered by 0.2s so one is always rising;
 * unlike a CSS `animate-bounce` unison-then-pause, the motion loop keeps the wave smooth.
 * Colors track the theme via `--muted-foreground`; pass `className` to restyle/resize.
 */
const dotTransition = (index: number): Transition => ({
  duration: 0.9,
  repeat: Infinity,
  repeatType: "loop",
  delay: index * 0.2,
  ease: "easeInOut",
});

export function LoaderOne({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} {...props}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={{ y: 0 }}
          animate={{ y: [0, -4, 0] }}
          transition={dotTransition(i)}
          className="size-1.5 rounded-full bg-muted-foreground/50"
        />
      ))}
    </div>
  );
}
