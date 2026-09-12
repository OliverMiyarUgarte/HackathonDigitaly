export const THEME_STORAGE_KEY = "digitaly-theme";

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

export function themeScript(): string {
  return `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
}

export function readStoredTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

let themeListeners: Array<() => void> = [];

export function subscribeTheme(listener: () => void): () => void {
  themeListeners = [...themeListeners, listener];
  return () => {
    themeListeners = themeListeners.filter((item) => item !== listener);
  };
}

export function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  return readStoredTheme();
}

export function getThemeServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  storeTheme(theme);
  document.documentElement.setAttribute("data-theme", theme);
  for (const listener of themeListeners) {
    listener();
  }
}
