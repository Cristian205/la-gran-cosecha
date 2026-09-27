import { useEffect, useId, useState } from "react";
import { obtenerCategorias } from "../../../api/resources";
import { tienda } from "../../../api/tienda";

/**
 * El destino de un botón o enlace.
 *
 * Sigue siendo texto —un negocio puede enlazar a donde quiera—, pero ofrece
 * lo que existe de verdad en SU tienda: sus páginas, sus categorías y las
 * secciones con ancla. Así nadie tiene que saber que la verdura es
 * `/tienda?categoria=3`, y un destino mal escrito se avisa antes de publicar
 * en vez de descubrirlo con un clic que no lleva a ninguna parte.
 */
interface Sugerencia {
  valor: string;
  etiqueta: string;
}

const FIJAS: Sugerencia[] = [
  { valor: "/", etiqueta: "Inicio" },
  { valor: "/tienda", etiqueta: "Tienda (catálogo completo)" },
  { valor: "/tienda/pedido", etiqueta: "Finalizar pedido" },
  { valor: "#cotizar", etiqueta: "Contacto → pedir cotización" },
  { valor: "#buscar-producto", etiqueta: "Contacto → buscar un producto" },
  { valor: "#hablar", etiqueta: "Contacto → hablar con el equipo" },
  { valor: "#hacer-pedido", etiqueta: "Contacto → hacer un pedido" },
];

let cache: Promise<Sugerencia[]> | null = null;

function sugerencias(): Promise<Sugerencia[]> {
  cache ??= Promise.all([tienda.paginas().catch(() => []), obtenerCategorias().catch(() => [])]).then(
    ([paginas, categorias]) => [
      ...FIJAS,
      ...paginas
        .filter((p) => !p.ruta.startsWith("/_") && !FIJAS.some((f) => f.valor === p.ruta))
        .map((p) => ({ valor: p.ruta, etiqueta: `Página: ${p.titulo}` })),
      ...categorias.map((c) => ({ valor: `/tienda?categoria=${c.id}`, etiqueta: `Categoría: ${c.nombre_categoria}` })),
    ]
  );
  return cache;
}

/** Lo que un destino puede ser. Lo demás casi siempre es un error de tipeo. */
function pareceValido(valor: string): boolean {
  if (!valor) return true;
  return /^(\/|#|https?:\/\/|mailto:|tel:)/.test(valor.trim());
}

export function CampoEnlace({
  etiqueta,
  ayuda,
  valor,
  placeholder,
  onCambio,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: string;
  placeholder?: string;
  onCambio: (valor: string) => void;
}) {
  const id = useId();
  const [lista, setLista] = useState<Sugerencia[]>(FIJAS);

  useEffect(() => {
    let vivo = true;
    sugerencias().then((s) => vivo && setLista(s));
    return () => {
      vivo = false;
    };
  }, []);

  const conocido = lista.find((s) => s.valor === valor);
  const valido = pareceValido(valor);

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        list={`${id}-lista`}
        value={valor}
        placeholder={placeholder ?? "/tienda"}
        onChange={(e) => onCambio(e.target.value)}
        aria-invalid={!valido || undefined}
      />
      <datalist id={`${id}-lista`}>
        {lista.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.etiqueta}
          </option>
        ))}
      </datalist>
      {!valido ? (
        <p className="campo-error">Un destino empieza por «/» (una página), «#» (una sección), «https://», «mailto:» o «tel:».</p>
      ) : conocido ? (
        <p className="campo-ayuda">→ {conocido.etiqueta}</p>
      ) : (
        ayuda && <p className="campo-ayuda">{ayuda}</p>
      )}
    </div>
  );
}
