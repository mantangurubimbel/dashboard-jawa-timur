"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const DEFAULT_THEME: Theme = "dark";
let clientTheme: Theme = DEFAULT_THEME;

function subscribeToTheme(callback: () => void) {
  window.addEventListener("dashboard-theme-change", callback);
  return () => window.removeEventListener("dashboard-theme-change", callback);
}

function getClientTheme() {
  return clientTheme;
}

function getServerTheme() {
  return DEFAULT_THEME;
}

function readSavedTheme(): Theme {
  const savedTheme = window.localStorage.getItem("dashboard-theme");
  return savedTheme === "dark" || savedTheme === "light" ? savedTheme : DEFAULT_THEME;
}

export function ThemeToggle() {
  // Keep the server snapshot and the first client snapshot identical. The
  // persisted browser preference is applied in the effect after hydration.
  const theme = useSyncExternalStore(subscribeToTheme, getClientTheme, getServerTheme);

  useEffect(() => {
    const savedTheme = readSavedTheme();
    if (clientTheme !== savedTheme) {
      clientTheme = savedTheme;
      window.dispatchEvent(new Event("dashboard-theme-change"));
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("dashboard-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    clientTheme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("dashboard-theme", nextTheme);
    window.dispatchEvent(new Event("dashboard-theme-change"));
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
      aria-label={isDark ? "Use light mode" : "Use dark mode"}
      title={isDark ? "Use light mode" : "Use dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
