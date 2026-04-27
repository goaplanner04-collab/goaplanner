export function getSavedTheme() {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem("goanow_theme") || "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("goanow_theme", theme);
  } catch {
    // localStorage unavailable — theme still applied for this session
  }
}
