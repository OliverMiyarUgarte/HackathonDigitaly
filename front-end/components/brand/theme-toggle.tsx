"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyTheme,
  getThemeServerSnapshot,
  getThemeSnapshot,
  subscribeTheme,
} from "@/lib/theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  const label = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="size-10 px-0 [&_svg]:size-[18px]"
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
    </Button>
  );
}
