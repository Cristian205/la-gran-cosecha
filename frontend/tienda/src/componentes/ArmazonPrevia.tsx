"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { BloqueColocado } from "@/lib/tipos";
import { Lienzo } from "@/bloques/Lienzo";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

/**
 * La cabecera y el pie, ya avisados de que puede haber un editor mirando —y
 * de que la página puede pedir quedarse sin pie.
 *
 * Fuera del editor y sin ninguna página pidiendo nada, esto es exactamente lo
 * que había antes: el armazón publicado del negocio de esta dirección, o los
 * de siempre si todavía no compuso ninguno.
 *
 * Dentro del editor (`?editor=1`) escucha el mismo canal que ya usa
 * `CapaEditor` para el contenido de la página, pero para el armazón. Sin
 * esto, editar una plantilla en el taller de Crynex enseñaba SIEMPRE el
 * navbar y el pie reales del negocio de referencia —nunca los que la
 * plantilla propone para los suyos—, porque este componente vive en
 * `layout.tsx`, que envuelve la página entera y no sabe nada de qué ruta se
 * está editando. Con una plantilla guardada desde ese mismo negocio la
 * diferencia no se nota; con cualquier otra, el demo le mostraría a un
 * cliente de boutique el menú de una verdulería.
 */
type MensajeDelPanel = {
  fuente: "crynex-editor";
  tipo: "armazon";
  bloques: BloqueColocado[];
};

interface Props {
  inicial: BloqueColocado[];
  origenPanel: string;
  children: React.ReactNode;
}

/**
 * El pie es del SITIO, no de la página — por eso vive en el armazón y no en
 * cada composición. Pero una pantalla de acceso es su propia página completa
 * (`Acceso.tsx` ya trae su propio pie con enlaces y aviso de cuenta), y el de
 * la tienda debajo solo le compite el sitio. Un bloque pide "sin pie" con
 * `useOcultarPieDeArmazon()` en vez de un campo en `Pagina`/`Plantilla`
 * porque la decisión es del BLOQUE que se coloca, no de la ruta donde alguien
 * decida ponerlo — la misma regla que `Bloque.a_sangre`.
 */
const ContextoArmazon = createContext<{ ocultarPie: () => void } | null>(null);

export function useOcultarPieDeArmazon() {
  const contexto = useContext(ContextoArmazon);
  useEffect(() => {
    contexto?.ocultarPie();
  }, [contexto]);
}

export function ArmazonPrevia({ inicial, origenPanel, children }: Props) {
  const parametros = useSearchParams();
  const enEditor = parametros.get("editor") === "1";
  const [bloques, setBloques] = useState(inicial);

  const pathname = usePathname();
  const [rutaDelPieOculto, setRutaDelPieOculto] = useState<string | null>(null);
  const [rutaVista, setRutaVista] = useState(pathname);
  // Se limpia al cambiar de ruta DURANTE el render, no en un efecto: si fuera
  // en un efecto, el de este componente —más arriba en el árbol— correría
  // DESPUÉS del efecto del bloque que pide ocultarlo, y borraría justo lo que
  // la página nueva acaba de pedir. React sí admite fijar estado mientras se
  // renderiza para "olvidar" algo cuando cambia lo que lo activó.
  if (pathname !== rutaVista) {
    setRutaVista(pathname);
    setRutaDelPieOculto(null);
  }

  const contexto = useMemo(
    () => ({ ocultarPie: () => setRutaDelPieOculto(pathname) }),
    [pathname]
  );

  const permitidos = useMemo(
    () =>
      origenPanel
        .split(",")
        .map((o) => o.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    [origenPanel]
  );

  useEffect(() => {
    if (!enEditor) return;
    function alRecibir(evento: MessageEvent) {
      if (permitidos.length > 0 && !permitidos.includes(evento.origin)) return;
      const dato = evento.data as MensajeDelPanel | undefined;
      if (dato?.fuente !== "crynex-editor" || dato.tipo !== "armazon") return;
      setBloques(dato.bloques);
    }
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [enEditor, permitidos]);

  const ocultarPie = rutaDelPieOculto === pathname;

  if (bloques.length === 0) {
    return (
      <ContextoArmazon.Provider value={contexto}>
        <Navbar />
        {children}
        {!ocultarPie && <Footer />}
      </ContextoArmazon.Provider>
    );
  }

  // Mismo reparto que ya hacía `Armazon` en `layout.tsx`: todo lo que va
  // ANTES del primer bloque `pie` envuelve por arriba, el resto por abajo.
  const corte = bloques.findIndex((b) => b.tipo === "pie");
  const arriba = corte === -1 ? bloques : bloques.slice(0, corte);
  const abajo = corte === -1 ? [] : bloques.slice(corte);

  return (
    <ContextoArmazon.Provider value={contexto}>
      <Lienzo bloques={arriba} />
      {children}
      {!ocultarPie && <Lienzo bloques={abajo} />}
    </ContextoArmazon.Provider>
  );
}
