import * as React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id="blueCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="126" height="126" rx="34" fill="#60A5FA" fillOpacity="0.15" />
      <rect x="16" y="16" width="126" height="126" rx="34" fill="none" stroke="#60A5FA" strokeOpacity="0.5" strokeWidth="3" />
      <rect x="38" y="44" width="42" height="6" rx="3" fill="#60A5FA" fillOpacity="0.5" />
      <rect x="38" y="61" width="70" height="6" rx="3" fill="#60A5FA" fillOpacity="0.5" />
      <rect x="38" y="78" width="56" height="6" rx="3" fill="#60A5FA" fillOpacity="0.5" />
      <g>
        <path d="M 92 58 L 150 58 A 34 34 0 0 1 184 92 L 184 150 A 34 34 0 0 1 150 184 L 58 184 L 58 92 A 34 34 0 0 1 92 58 Z" fill="url(#blueCard)" />
        <path d="M 92 58 L 150 58 A 34 34 0 0 1 184 92 L 184 150 A 34 34 0 0 1 150 184 L 58 184 L 58 92 A 34 34 0 0 1 92 58 Z" fill="none" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2" />
      </g>
      <path d="M 121 86 Q 121 121 86 121 Q 121 121 121 156 Q 121 121 156 121 Q 121 121 121 86 Z" fill="#FFFFFF" />
    </svg>
  );
}
