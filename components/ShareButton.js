"use client";

import { useState } from "react";

export default function ShareButton() {
  const [toast, setToast] = useState(null);

  const handleShare = async () => {
    const data = {
      title: "GoaNow 🔥",
      text: "Found this — nearby cafes, tonight's parties, AI trip planner for Goa. Only ₹99 for your whole trip.",
      url: "https://goanow.in"
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
      } catch (e) {
        // user cancelled — silent
      }
    } else {
      try {
        await navigator.clipboard.writeText(data.url);
        setToast("Link copied! Share on WhatsApp 🔥");
        setTimeout(() => setToast(null), 3000);
      } catch (e) {
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
          bottom: 24,
          right: 24,
          zIndex: 100,
          borderRadius: 999,
          padding: "12px 18px",
          fontSize: 14,
          boxShadow: "0 0 30px rgba(255, 45, 120, 0.7)"
        }}
        aria-label="Share GoaNow"
      >
        📤 Share GoaNow
      </button>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
