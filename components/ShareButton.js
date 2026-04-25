"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

export default function ShareButton() {
  const [toast, setToast] = useState(null);

  const handleShare = async () => {
    const data = {
      title: "GoaNow",
      text: "Nearby cafes, tonight's parties, and an AI trip planner for Goa.",
      url: "https://goanow.in",
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // Share cancelled.
      }
    } else {
      try {
        await navigator.clipboard.writeText(data.url);
        setToast("Link copied");
        setTimeout(() => setToast(null), 3000);
      } catch {
        setToast("Could not copy. Try again.");
        setTimeout(() => setToast(null), 3000);
      }
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="neon-btn"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 100,
          borderRadius: 999,
          padding: "12px 16px",
          fontSize: 14,
          boxShadow: "0 0 30px rgba(255, 61, 129, 0.6)",
        }}
        aria-label="Share GoaNow"
      >
        <Icon name="share" size={17} />
        Share
      </button>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
