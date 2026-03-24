import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      {...props}
    >
      <rect width="48" height="48" rx="12" fill="url(#logoGrad)" />
      <rect x="8" y="10" width="32" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="8" y="22" width="32" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="8" y="34" width="32" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="8" y="10" width="3" height="27" rx="1.5" fill="white" fillOpacity="0.7" />
      <rect x="37" y="10" width="3" height="27" rx="1.5" fill="white" fillOpacity="0.7" />
      <rect x="13" y="13.5" width="7" height="7" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="22" y="13.5" width="5" height="7" rx="2" fill="white" fillOpacity="0.6" />
      <rect x="29" y="13.5" width="7" height="7" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="13" y="25.5" width="5" height="7" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="20" y="25.5" width="9" height="7" rx="2" fill="white" fillOpacity="0.6" />
      <rect x="31" y="25.5" width="5" height="7" rx="2" fill="white" fillOpacity="0.9" />
      <path d="M30 8 L34 4 L38 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="34" y1="4" x2="34" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
