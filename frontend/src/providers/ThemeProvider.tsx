import { type PropsWithChildren, useEffect } from "react";
import { useUiStore } from "../store/ui.store";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const dark = theme === "dark" || (theme === "system" && prefersDark());
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }, [theme]);

  return children;
}
