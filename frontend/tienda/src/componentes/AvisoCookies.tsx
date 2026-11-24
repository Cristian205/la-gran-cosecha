"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  CATEGORIAS,
  EVENTO_ABRIR_PREFERENCIAS,
  abrirPreferenciasCookies,
  borrarCategoria,
  guardarConsentimiento,
  leerConsentimiento,
  type CategoriaCookie,
  type Consentimiento,
} from "@/lib/legal/cookies";
import { useClienteTienda } from "@/estado/clienteTienda";
import { useUltimoPedido } from "@/estado/ultimoPedido";

type Opcional = Exclude<CategoriaCookie, "necesarias">;
type Seleccion = Consentimiento["categorias"];

/** Solo se ofrecen las categorías que la tienda usa de verdad. */
const OFRECIDAS = CATEGORIAS.filter((c) => c.enUso);

function seleccionCon(valor: boolean): Seleccion {
  const s = { funcionales: false, analiticas: false, publicitarias: false } as Seleccion;
  for (const c of OFRECIDAS) if (!c.obligatoria) s[c.id as Opcional] = valor;
  return s;
}

/**
 * Aviso de consentimiento de cookies. Sale en la primera visita (o cuando sube
 * `VERSION_CONSENTIMIENTO`) y se reabre desde «Configurar cookies» en la
 * política. No bloquea la tienda: es un aviso, no un muro.
 *
 * «Solo necesarias» y «Aceptar todas» pesan lo mismo a propósito: rechazar no
 * puede costar más que aceptar.
 */
export function AvisoCookies() {
  const [visible, setVisible] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [seleccion, setSeleccion] = useState<Seleccion>(() => seleccionCon(false));
  const idTitulo = useId();

  useEffect(() => {
    const actual = leerConsentimiento();
    if (!actual) setVisible(true);

    const abrir = () => {
      const guardado = leerConsentimiento();
      setSeleccion(guardado ? guardado.categorias : seleccionCon(false));
      setConfigurando(true);
      setVisible(true);
    };
    window.addEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir);
  }, []);

  async function decidir(elegidas: Seleccion) {
    guardarConsentimiento(elegidas);
    if (elegidas.funcionales) {
      // Recupera lo que ya hubiera guardado y escribe lo de esta visita.
      await Promise.all([useClienteTienda.persist.rehydrate(), useUltimoPedido.persist.rehydrate()]);
      useClienteTienda.setState({});
      useUltimoPedido.setState({});
    } else {
      borrarCategoria("funcionales");
    }
    setVisible(false);
    setConfigurando(false);
  }

  if (!visible) return null;

  return (
    <section className="aviso-cookies" role="region" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="aviso-cookies-titulo">Tu privacidad</h2>
      <p className="aviso-cookies-texto">
        Usamos el almacenamiento del navegador para que tu carrito funcione y, si lo permites, para
        recordar tus datos y tu último pedido. No usamos cookies de publicidad ni de analítica.{" "}
        <Link href="/politica-de-cookies">Política de cookies</Link>
      </p>

      {configurando && (
        <ul className="aviso-cookies-categorias">
          {OFRECIDAS.map((c) => {
            const id = `cookie-${c.id}`;
            const marcada = c.obligatoria || seleccion[c.id as Opcional];
            return (
              <li key={c.id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={marcada}
                  disabled={c.obligatoria}
                  onChange={(e) =>
                    setSeleccion((s) => ({ ...s, [c.id]: e.target.checked }))
                  }
                />
                <label htmlFor={id}>
                  <strong>
                    {c.nombre}
                    {c.obligatoria && <span> · siempre activas</span>}
                  </strong>
                  <span>{c.descripcion}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="aviso-cookies-acciones">
        {configurando ? (
          <button type="button" className="aviso-cookies-btn" onClick={() => decidir(seleccion)}>
            Guardar selección
          </button>
        ) : (
          <button type="button" className="aviso-cookies-btn aviso-cookies-btn--texto" onClick={() => setConfigurando(true)}>
            Configurar
          </button>
        )}
        <button type="button" className="aviso-cookies-btn" onClick={() => decidir(seleccionCon(false))}>
          Solo necesarias
        </button>
        <button type="button" className="aviso-cookies-btn" onClick={() => decidir(seleccionCon(true))}>
          Aceptar todas
        </button>
      </div>
    </section>
  );
}

/** Botón para reabrir el aviso desde cualquier página (p. ej. la política). */
export function BotonPreferenciasCookies({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`aviso-cookies-reabrir ${className}`}
      onClick={abrirPreferenciasCookies}
    >
      Configurar cookies
    </button>
  );
}
