"use client";

import { CATEGORIES } from "@/lib/spotsData";

export default function CategoryFilter({ active, onChange }) {
  return (
    <div
      className="hide-scrollbar"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "4px 0 12px",
        WebkitOverflowScrolling: "touch"
      }}
    >
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={"category-pill" + (active === c.key ? " active" : "")}
        >
          <span>{c.emoji}</span> {c.label}
        </button>
      ))}
    </div>
  );
}
