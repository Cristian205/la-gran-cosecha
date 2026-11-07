import { familiaCategoria, iconoCategoria, subtituloCategoria } from "@/lib/utiles";

/**
 * La identidad visual de una categoría, en sus dos formas: el distintivo
 * sobre la foto de cada tarjeta y el encabezado que abre su grupo en el
 * catálogo. Comparten familia (`data-familia`), icono y paleta —frutas verde
 * botánico, verduras verde natural, tubérculos tierra cálida, granos dorado
 * natural; el resto, un crema neutro— para que "Frutas" se reconozca igual en
 * los dos sitios. Las categorías son las reales del backend: la familia se
 * deduce de su nombre, como el icono de la vitrina de Inicio.
 */

export function BadgeCategoria({ nombre }: { nombre: string }) {
  const Icono = iconoCategoria(nombre);
  return (
    <span className="pcard-badge" data-familia={familiaCategoria(nombre) ?? "otra"}>
      <Icono size={14} className="pcard-badge-icono" aria-hidden="true" />
      <span className="pcard-badge-texto">{nombre}</span>
    </span>
  );
}

export function EncabezadoCategoria({
  nombre,
  subtitulo,
  cantidad,
}: {
  nombre: string;
  /** El subtítulo propio de la categoría (panel); si no hay, uno por familia. */
  subtitulo?: string | null;
  cantidad?: number | null;
}) {
  const Icono = iconoCategoria(nombre);
  const texto = subtituloCategoria(nombre, subtitulo);
  return (
    <header className="pgrid-separador" data-familia={familiaCategoria(nombre) ?? "otra"}>
      <span className="pgrid-sep-icono" aria-hidden="true">
        <Icono size={30} />
      </span>
      <span className="pgrid-sep-texto">
        <h3 className="pgrid-sep-nombre">{nombre}</h3>
        {texto && <span className="pgrid-sep-sub">{texto}</span>}
      </span>
      {cantidad ? (
        <span className="pgrid-sep-cuenta">
          <b>{cantidad}</b> {cantidad === 1 ? "producto" : "productos"}
        </span>
      ) : null}
    </header>
  );
}
