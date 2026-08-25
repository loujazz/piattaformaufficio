import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "presenze-marconi-theme";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // localStorage non disponibile (es. modalità privata): usiamo il tema di sistema.
  }
  return "system";
}

function applyTheme(theme: ThemePreference): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/** Preferenza di tema (chiaro/scuro/sistema), persistita in localStorage e applicata via [data-theme] su <html>. */
export function useTheme(): { theme: ThemePreference; cycleTheme: () => void } {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ThemePreference = current === "system" ? "light" : current === "light" ? "dark" : "system";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // se il salvataggio fallisce il tema resta comunque applicato per la sessione corrente
      }
      return next;
    });
  }, []);

  return { theme, cycleTheme };
}
