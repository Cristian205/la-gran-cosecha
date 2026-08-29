import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Tema = "claro" | "oscuro";

const CLAVE = "crynex-tema";

interface ThemeState {
  tema: Tema;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function temaInicial(): Tema {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === "claro" || guardado === "oscuro") return guardado;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.setAttribute("data-tema", tema);
    localStorage.setItem(CLAVE, tema);
  }, [tema]);

  const value = useMemo(
    () => ({
      tema,
      alternarTema: () => setTema((t) => (t === "claro" ? "oscuro" : "claro")),
    }),
    [tema]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
