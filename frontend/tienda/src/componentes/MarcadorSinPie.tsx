"use client";

import { useOcultarPieDeArmazon } from "./ArmazonPrevia";

/**
 * No pinta nada: solo le avisa a `ArmazonPrevia` que esta página no lleva el
 * pie del sitio. Existe como componente aparte —en vez de la llamada directa
 * dentro de `Acceso.tsx`— porque ese archivo es un componente de SERVIDOR
 * (imprime HTML del negocio sin JavaScript de más) y el aviso necesita un
 * efecto, que solo corre en el cliente.
 */
export function MarcadorSinPie() {
  useOcultarPieDeArmazon();
  return null;
}
