"use client";

import Icon from "@/components/Icon";
import { CATEGORIES } from "@/lib/spotsData";

const CATEGORY_ICONS = {
  all: "sparkles",
  cafe: "coffee",
  restobar: "cocktail",
  seafood: "fish",
  beach: "waves",
  hidden_gem: "leaf",
  scooter_rental: "scooter",
};

export default function CategoryFilter({ active, onChange }) {
  return (
    <div
      className="hide-scrollbar"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "4px 0 12px",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {CATEGORIES.map((category) => (
        <button
          key={category.key}
          onClick={() => onChange(category.key)}
          className={"category-pill" + (active === category.key ? " active" : "")}
        >
          <Icon name={CATEGORY_ICONS[category.key] || "sparkles"} size={15} />
          {category.label}
        </button>
      ))}
    </div>
  );
}
