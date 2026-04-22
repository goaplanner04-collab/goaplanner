"use client";

export default function LoadingSkeleton({ count = 4, height = 180 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height,
            width: "100%",
            border: "1px solid var(--border-glass)"
          }}
        />
      ))}
    </div>
  );
}

export function PulsingDotLoader({ text = "Finding spots near you..." }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        gap: 16
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--neon-pink)",
          boxShadow: "0 0 24px var(--neon-pink)",
          animation: "pulseNeon 1.6s ease-in-out infinite"
        }}
      />
      <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{text}</div>
    </div>
  );
}
