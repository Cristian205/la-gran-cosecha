import Link from "next/link";

/**
 * Una dirección que no corresponde a ninguna tienda.
 *
 * Ocurre de verdad: un subdominio que nadie ha registrado, un negocio
 * suspendido, un dominio propio aún sin verificar. No se dice cuál de las tres
 * cosas es — eso sería contar si un negocio existe a quien pregunta por él.
 */
export default function NoEncontrado() {
  return (
    <main className="pagina-vacia">
      <h1>Esta tienda no existe</h1>
      <p>
        La dirección por la que llegaste no corresponde a ninguna tienda activa.
        Comprueba el enlace, o pregúntale al negocio cuál es su dirección.
      </p>
      <Link className="btn-primario" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
