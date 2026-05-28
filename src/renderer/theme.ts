export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "jobpilot-theme";

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function getStoredTheme(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}
