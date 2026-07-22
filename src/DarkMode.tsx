import { useEffect, useState } from "react";
import "./App.css";

type Theme = "light" | "dark";

// Initial theme: a previously saved choice, otherwise the OS preference.
function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function DarkMode() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply the theme to <html data-theme="..."> and remember the choice.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="dark-mode-toggle"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? "☀️" : "🌙"}
    </button>
  );
}

export default DarkMode;
