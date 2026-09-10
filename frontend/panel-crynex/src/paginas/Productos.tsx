/**
 * El catálogo comercial: lo que Crynex vende.
 *
 * Antes de que existiera, "Catálogo" o "Pedidos" era una cadena de texto
 * repetida en cada permiso (`PermisoDisponible.modulo`), lo que hacía
 * imposible darle a un producto descripción, categoría o estado propios.
 * Ahora es una fila, y este es su formulario.
 *
 * Mismo patrón que `Presets.tsx`: lista a la izquierda, editor a la derecha
 * con un borrador local — nada se envía hasta pulsar Guardar.
 */
import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import type { Producto } from "../api/tipos";
import { usarPlataforma } from "../datos/plataforma";
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { Confirmar, Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

function slugificar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function Productos() {
  const { productos, cargando, error, crearProducto, guardarProducto, archivarProducto } =
    usarPlataforma();
  const avisar = usarAviso();

  const [elegido, setElegido] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<Producto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [retirando, setRetirando] = useState<Producto | null>(null);

  useEffect(() => {
    if (elegido === null && productos.length > 0) setElegido(productos[0].id);
  }, [elegido, productos]);

  useEffect(() => {
    const actual = productos.find((p) => p.id === elegido) ?? null;
    setBorrador(actual ? { ...actual } : null);
  }, [elegido, productos]);

  const sucio = useMemo(() => {
    if (!borrador) return false;
    const original = productos.find((p) => p.id === borrador.id);
    return original ? JSON.stringify(original) !== JSON.stringify(borrador) : false;
  }, [borrador, productos]);

  function cambiar(cambios: Partial<Producto>) {
    setBorrador((previo) => (previo ? { ...previo, ...cambios } : previo));
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      await guardarProducto(borrador.id, {
        nombre: borrador.nombre,
        descripcion: borrador.descripcion,
        categoria: borrador.categoria,
        icono: borrador.icono,
        estado: borrador.estado,
        orden: borrador.orden,
      });
      avisar("Producto guardado.");
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  async function crear() {
    if (!nombreNuevo.trim()) return;
    setGuardando(true);
    try {
      const creado = await crearProducto({
        nombre: nombreNuevo.trim(),
        slug: slugificar(nombreNuevo),
        descripcion: "",
        categoria: "",
        icono: "",
        estado: "ACTIVO",
        orden: productos.length,
      });
      setElegido(creado.id);
      setCreando(false);
      setNombreNuevo("");
      avisar("Producto creado. Ya se le pueden asociar permisos.");
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  async function retirar() {
    if (!retirando) return;
    setGuardando(true);
    try {
      await archivarProducto(retirando);
      setRetirando(null);
      setElegido(null);
      avisar("Producto archivado.");
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="grid gap-3 grid-cols-[260px_1fr]">
        <Esqueleto alto={280} />
        <Esqueleto alto={420} />
      </div>
    );
  }

  return (
    <>
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Productos</h1>
          <p className="tenue">
            Las soluciones que Crynex comercializa. Qué permisos concede cada uno
            se ve en <code>Permisos</code>, eligiendo este producto al crearlos.
          </p>
        </div>
        <Boton variante="primario" icono={<Plus size={14} />} onClick={() => setCreando(true)}>
          Nuevo producto
        </Boton>
      </header>

      {error && <Aviso>{error}</Aviso>}

      {productos.length === 0 ? (
        <EstadoVacio
          icono={Package}
          titulo="Todavía no hay productos"
          accion={
            <Boton variante="primario" onClick={() => setCreando(true)}>
              Crear el primero
            </Boton>
          }
        >
          Sin productos, los permisos no tienen a qué solución agruparse.
        </EstadoVacio>
      ) : (
        <div className="grid gap-3 items-start grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <nav className="tarjeta" aria-label="Productos">
            <div className="tarjeta__cuerpo flex flex-col gap-1">
              {productos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setElegido(p.id)}
                  className={`text-left rounded px-3 py-2 ${
                    elegido === p.id ? "bg-[var(--acento-suave,#eef2ff)] font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.nombre}
                    {p.estado !== "ACTIVO" && (
                      <Insignia tono="neutro">
                        {p.estado === "BORRADOR" ? "Borrador" : "Archivado"}
                      </Insignia>
                    )}
                  </div>
                  <div className="tenue text-xs">
                    {p.categoria || "Sin categoría"} · {p.permisos}{" "}
                    {p.permisos === 1 ? "permiso" : "permisos"}
                  </div>
                </button>
              ))}
            </div>
          </nav>

          {borrador && (
            <section className="tarjeta">
              <header className="tarjeta__cabecera">
                <div>
                  <h2>{borrador.nombre}</h2>
                  <p className="tenue text-xs">
                    <code>{borrador.slug}</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Boton
                    variante="peligro"
                    tamano="pequeno"
                    icono={<Trash2 size={13} />}
                    onClick={() => setRetirando(borrador)}
                  >
                    Retirar
                  </Boton>
                  <Boton
                    variante="primario"
                    cargando={guardando}
                    disabled={!sucio}
                    onClick={guardar}
                  >
                    {sucio ? "Guardar" : "Sin cambios"}
                  </Boton>
                </div>
              </header>

              <div className="tarjeta__cuerpo flex flex-col gap-4">
                <Campo etiqueta="Nombre">
                  <input
                    value={borrador.nombre}
                    onChange={(e) => cambiar({ nombre: e.target.value })}
                  />
                </Campo>
                <Campo
                  etiqueta="Descripción"
                  ayuda="Lo que se lee en la tabla de precios y en el catálogo."
                >
                  <input
                    value={borrador.descripcion}
                    onChange={(e) => cambiar({ descripcion: e.target.value })}
                  />
                </Campo>
                <Campo etiqueta="Categoría" ayuda="Agrupa productos: Ventas, Operación, Datos…">
                  <input
                    value={borrador.categoria}
                    onChange={(e) => cambiar({ categoria: e.target.value })}
                  />
                </Campo>
                <Campo
                  etiqueta="Ícono"
                  ayuda="Un nombre de ícono de lucide-react; el panel de cada negocio resuelve el dibujo."
                >
                  <input
                    value={borrador.icono}
                    onChange={(e) => cambiar({ icono: e.target.value })}
                  />
                </Campo>
                <Campo etiqueta="Estado">
                  <select
                    value={borrador.estado}
                    onChange={(e) =>
                      cambiar({ estado: e.target.value as Producto["estado"] })
                    }
                  >
                    <option value="BORRADOR">Borrador</option>
                    <option value="ACTIVO">Activo</option>
                    <option value="ARCHIVADO">Archivado</option>
                  </select>
                </Campo>

                <dl className="datos">
                  <div className="dato">
                    <dt>Permisos</dt>
                    <dd>{borrador.permisos}</dd>
                  </div>
                  <div className="dato">
                    <dt>Planes que lo conceden</dt>
                    <dd>{borrador.planes}</dd>
                  </div>
                </dl>
              </div>
            </section>
          )}
        </div>
      )}

      {creando && (
        <Modal
          titulo="Nuevo producto"
          descripcion="Una solución nueva que Crynex comercializa."
          onCerrar={() => setCreando(false)}
          pie={
            <>
              <Boton onClick={() => setCreando(false)}>Cancelar</Boton>
              <Boton variante="primario" cargando={guardando} onClick={crear}>
                Crear
              </Boton>
            </>
          }
        >
          <Campo etiqueta="Nombre" ayuda="Por ejemplo: CRM, Inventario, Domicilios.">
            <input
              autoFocus
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crear()}
            />
          </Campo>
        </Modal>
      )}

      {retirando && (
        <Confirmar
          titulo={`¿Retirar «${retirando.nombre}»?`}
          afecta={
            retirando.permisos > 0
              ? `${retirando.permisos} ${retirando.permisos === 1 ? "permiso" : "permisos"}`
              : "ningún permiso"
          }
          etiquetaAccion="Retirar"
          peligrosa
          trabajando={guardando}
          onCerrar={() => setRetirando(null)}
          onConfirmar={retirar}
          consecuencias={
            <>
              {retirando.permisos > 0 ? (
                <p>
                  Tiene permisos asociados: queda archivado en vez de borrarse, para
                  no dejarlos huérfanos.
                </p>
              ) : (
                <p>Sin permisos asociados, se borra sin dejar rastro.</p>
              )}
            </>
          }
        />
      )}
    </>
  );
}
