"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { suscribirAlBoletin } from "@/lib/datos";
import { Seccion, claseDeVariante } from "./Seccion";

/**
 * Dejar el correo para que te escriban.
 *
 * Tiene una tabla detrás —`contact.Suscriptor`— y eso no es un detalle de
 * implementación: es la razón de que este bloque exista y no sea un adorno.
 * Se podía haber escrito mandando un mensaje de contacto con el texto
 * «suscripción», o directamente sin enviar nada, y en los dos casos el
 * visitante vería «gracias» y no estaría apuntado en ninguna parte.
 *
 * Un formulario que recoge correos y no los guarda es peor que no tener el
 * formulario.
 *
 * # Apuntarse dos veces no es un error
 *
 * Quien no está seguro de si funcionó vuelve a pulsar. El servidor responde
 * que sí —reactivando la suscripción si estaba de baja— en vez de un error por
 * correo repetido, que le diría que algo se rompió cuando en realidad ya
 * estaba dentro.
 */
const VARIANTES = ["banda", "tarjeta"] as const;

interface Props {
  kicker?: string;
  titulo?: string;
  texto?: string;
  boton_texto?: string;
  /** El aviso pequeño de debajo. Aquí es donde el negocio pone lo que la ley
   *  le pida decir; el bloque no lo inventa por él. */
  nota?: string;
  centrado?: boolean;
  variante?: string;
}

export function Boletin({
  kicker,
  titulo = "Enterate de lo nuevo",
  texto = "Te escribimos cuando hay algo que vale la pena, no cada semana.",
  boton_texto = "Suscribirme",
  nota = "",
  centrado = false,
  variante,
}: Props) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"listo" | "enviando" | "hecho" | "fallo">("listo");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || estado === "enviando") return;

    setEstado("enviando");
    try {
      await suscribirAlBoletin(email.trim());
      setEstado("hecho");
      setEmail("");
    } catch {
      // No se dice «ya estabas suscrito» ni nada parecido: quien pregunta por
      // un correo desde fuera no debe poder averiguar si está en la lista de
      // este negocio. El servidor tampoco lo distingue, y por eso este fallo
      // solo puede ser de red.
      setEstado("fallo");
    }
  }

  return (
    <Seccion
      kicker={kicker}
      centrado={centrado}
      className={claseDeVariante(variante, VARIANTES, "boletin", "banda")}
    >
      <div className="boletin">
        <div className="boletin-texto">
          <h3>
            <Mail size={18} aria-hidden="true" /> {titulo}
          </h3>
          {texto && <p>{texto}</p>}
        </div>

        {estado === "hecho" ? (
          <p className="boletin-hecho" role="status">
            Listo. Te escribimos pronto.
          </p>
        ) : (
          <form className="boletin-forma" onSubmit={enviar}>
            <input
              type="email"
              required
              value={email}
              placeholder="tu@correo.com"
              aria-label="Tu correo electrónico"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn" type="submit" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Enviando…" : boton_texto}
            </button>
          </form>
        )}
      </div>

      {estado === "fallo" && (
        <p className="boletin-fallo" role="alert">
          No se pudo enviar. Revisa la conexión e inténtalo otra vez.
        </p>
      )}
      {nota && estado !== "hecho" && <p className="boletin-nota">{nota}</p>}
    </Seccion>
  );
}
