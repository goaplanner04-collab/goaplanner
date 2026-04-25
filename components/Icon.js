"use client";

const PATHS = {
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
      <path d="M16 10h1.2a2.3 2.3 0 0 1 0 4.6H16M7 4v2M11 4v2M15 4v2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2.2 5-5 2.2 2.2-5 5-2.2Z" />
    </>
  ),
  cocktail: (
    <>
      <path d="M6 4h12l-6 7-6-7Z" />
      <path d="M12 11v7M8 20h8M15 4l3-2" />
    </>
  ),
  directions: (
    <>
      <path d="M12 3 4 12l8 9 8-9-8-9Z" />
      <path d="M10 14v-3h4M14 11l-2-2" />
    </>
  ),
  fish: (
    <>
      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" />
      <path d="m3 12-2.2 3M3 12 .8 9M15 12h.01" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15Z" />
      <path d="M5 19c3-5 7-8 12-10" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  phone: (
    <path d="M7 4 4.8 6.2c-.7.7-.9 1.8-.4 2.7A24 24 0 0 0 15 19.6c.9.5 2 .3 2.7-.4L20 17l-4-3-2 2c-2.3-1.2-4.1-3-5.2-5.2l2-2L7 4Z" />
  ),
  refresh: (
    <>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M18.5 11A6.5 6.5 0 0 0 7 6.8L4 10m2 3a6.5 6.5 0 0 0 11.5 4.2L20 14" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 6h4a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />
    </>
  ),
  scooter: (
    <>
      <circle cx="7" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M10 17h3l2-7h3l2 7M6 14l2-5h4M16 10l-2-3" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-3.4M8.7 13.3l6.6 3.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 5-3.2 8.2-8 9-4.8-.8-8-4-8-9V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.4 4.3L18 9l-4.6 1.7L12 15l-1.4-4.3L6 9l4.6-1.7L12 3Z" />
      <path d="M5 14l.7 2.1L8 17l-2.3.9L5 20l-.7-2.1L2 17l2.3-.9L5 14ZM19 13l.6 1.8 1.9.7-1.9.7L19 18l-.6-1.8-1.9-.7 1.9-.7L19 13Z" />
    </>
  ),
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M9 5v14" />
    </>
  ),
  waves: (
    <>
      <path d="M3 9c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2S18.4 9 21 9" />
      <path d="M3 15c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.8-2" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className, style }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "0 0 auto", ...style }}
    >
      {PATHS[name] || PATHS.sparkles}
    </svg>
  );
}
