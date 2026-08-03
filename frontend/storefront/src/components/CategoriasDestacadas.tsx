import { Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerCategorias } from "../api/catalog";
import type { Categoria } from "../types";
import { colorCategoria } from "../utils";

export function CategoriasDestacadas() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  if (categorias.length === 0) return null;

  return (
    <section className="seccion">
      <div className="seccion-titulo">
        <h2>Compra por categoría</h2>
        <span className="linea">Encuentra justo lo que necesitas</span>
      </div>
      <div className="categorias-grid">
        {categorias.map((c) => (
          <Link
            key={c.id}
            to={`/tienda?categoria=${c.id}`}
            className="categoria-tile"
            style={{ background: colorCategoria(c.id) }}
          >
            <Sprout size={24} strokeWidth={1.6} />
            <span>{c.nombre_categoria}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
