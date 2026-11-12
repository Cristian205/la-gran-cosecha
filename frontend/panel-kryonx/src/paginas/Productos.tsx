/**
 * Productos: el portafolio comercial de Crafteech.
 *
 * Una lista con dos representaciones (tabla y tarjetas) sobre los mismos
 * filtros, igual que Empresas. Editar un producto no pasa aquí: la fila lleva a
 * su ficha (`ProductoFicha`), con pestañas. Lo que sí se hace desde la lista es
 * crearlo y retirarlo.
 *
 * Producto → Módulos → Funcionalidades → Permisos son cosas distintas: el
 * producto se vende; el módulo es la agrupación (`modulo`) de sus permisos; la
 * funcionalidad es lo que un plan promete y no es un permiso (soporte, SLA); el
 * permiso es lo que la app comprueba. Aquí solo se administran los productos.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { EstadoComercial, Producto } from "../api/tipos";
import { empresasPorProducto, ETIQUETA_ESTADO_PRODUCTO, TONO_ESTADO_PRODUCTO } from "../datos/productos";
import { numero } from "../datos/formato";
import { usarPlataforma } from "../datos/plataforma";
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { Menu, OpcionMenu } from "../ui/Menu";
import { EncabezadoPagina } from "../componentes/piezas";
import { ModalAsistente, Resumen } from "../ui/Asistente";
import { Confirmar } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";
import { SelectorVista, type ModoVista } from "../componentes/empresas/FiltrosEmpresas";
import "./productos.css";

const POR_PAGINA = 12;
const CLAVE_VISTA = "crafteech_productos_vista";

type Columna = "nombre" | "categoria" | "estado" | "permisos" | "planes" | "empresas";

export function slugificar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function vistaGuardada(): ModoVista {
  try {
    return localStorage.getItem(CLAVE_VISTA) === "tarjetas" ? "tarjetas" : "tabla";
  } catch {
    return "tabla";
  }
}

export function Productos() {
  const { productos, permisos, negocios, planes, suscripciones, cargando, error, crearProducto, archivarProducto } =
    usarPlataforma();
  const avisar = usarAviso();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();

  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState<EstadoComercial | "">("");
  const [orden, setOrden] = useState<{ columna: Columna; sentido: "asc" | "desc" }>({ columna: "nombre", sentido: "asc" });
  const [pagina, setPagina] = useState(0);
  const [vista, setVista] = useState<ModoVista>(vistaGuardada);

  // `?nuevo=1` llega desde el Command Center.
  const [creando, setCreando] = useState(parametros.get("nuevo") === "1");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [descripcionNueva, setDescripcionNueva] = useState("");
  const [iconoNuevo, setIconoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [retirando, setRetirando] = useState<Producto | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_VISTA, vista);
    } catch {
      /* sin almacenamiento la vista no se recuerda: no es un error */
    }
  }, [vista]);

  const empresas = useMemo(
    () => empresasPorProducto(productos, permisos, negocios, planes, suscripciones),
    [productos, permisos, negocios, planes, suscripciones]
  );

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [productos]
  );

  const cifras = useMemo(
    () => ({
      total: productos.length,
      publicados: productos.filter((p) => p.estado === "ACTIVO").length,
      borradores: productos.filter((p) => p.estado === "BORRADOR").length,
      archivados: productos.filter((p) => p.estado === "ARCHIVADO").length,
    }),
    [productos]
  );

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const lista = productos.filter((p) => {
      if (categoria && p.categoria !== categoria) return false;
      if (estado && p.estado !== estado) return false;
      if (!q) return true;
      return [p.nombre, p.slug, p.categoria].some((c) => c.toLowerCase().includes(q));
    });
    const clave = (p: Producto): string | number => {
      switch (orden.columna) {
        case "nombre": return p.nombre.toLowerCase();
        case "categoria": return p.categoria.toLowerCase();
        case "estado": return p.estado;
        case "permisos": return p.permisos;
        case "planes": return p.planes;
        case "empresas": return empresas.get(p.id) ?? 0;
      }
    };
    const f = orden.sentido === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      const x = clave(a);
      const y = clave(b);
      return (x < y ? -1 : x > y ? 1 : a.nombre.localeCompare(b.nombre)) * f;
    });
  }, [productos, texto, categoria, estado, orden, empresas]);

  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas - 1);
  const enPantalla = visibles.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA);
  const hayFiltros = Boolean(texto || categoria || estado);

  function ordenarPor(columna: Columna) {
    setOrden((o) => ({ columna, sentido: o.columna === columna && o.sentido === "asc" ? "desc" : "asc" }));
    setPagina(0);
  }

  // Validación del alta: el slug sale del nombre y no puede repetirse.
  const slugNuevo = slugificar(nombreNuevo);
  const errorAlta = !nombreNuevo.trim()
    ? null
    : !slugNuevo
      ? "Usa letras o números en el nombre."
      : productos.some((p) => p.slug === slugNuevo)
        ? "Ya existe un producto con ese identificador."
        : productos.some((p) => p.nombre.trim().toLowerCase() === nombreNuevo.trim().toLowerCase())
          ? "Ya existe un producto con ese nombre."
          : null;

  function cerrarAlta() {
    setCreando(false);
    setNombreNuevo("");
    setCategoriaNueva("");
    setDescripcionNueva("");
    setIconoNuevo("");
    if (parametros.has("nuevo")) setParametros({});
  }

  async function crear() {
    if (!nombreNuevo.trim() || errorAlta) return;
    setGuardando(true);
    try {
      const creado = await crearProducto({
        nombre: nombreNuevo.trim(),
        slug: slugNuevo,
        descripcion: descripcionNueva.trim(),
        categoria: categoriaNueva.trim(),
        icono: iconoNuevo.trim(),
        // Nace como borrador: se publica cuando tiene permisos y planes.
        estado: "BORRADOR",
        orden: productos.length,
      });
      cerrarAlta();
      avisar("Producto creado como borrador. Complétalo y publícalo desde su ficha.");
      navegar(`/productos/${creado.id}`);
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
      avisar(retirando.permisos > 0 ? "Producto archivado." : "Producto eliminado.");
      setRetirando(null);
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  const th = (columna: Columna, etiqueta: string, clase = "") => (
    <th
      className={clase}
      aria-sort={orden.columna === columna ? (orden.sentido === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="th-orden" onClick={() => ordenarPor(columna)}>
        {etiqueta}
        <ChevronDown
          size={12}
          className={`th-orden__flecha ${orden.columna === columna ? `esta-activa ${orden.sentido}` : ""}`}
        />
      </button>
    </th>
  );

  const acciones = (p: Producto) => (
    <Menu etiqueta={`Acciones de ${p.nombre}`}>
      {(cerrar) => (
        <>
          <OpcionMenu
            icono={<Pencil size={14} />}
            onClick={() => {
              cerrar();
              navegar(`/productos/${p.id}`);
            }}
          >
            Abrir ficha
          </OpcionMenu>
          <OpcionMenu
            icono={<Trash2 size={14} />}
            peligrosa
            disabled={p.estado === "ARCHIVADO"}
            onClick={() => {
              cerrar();
              setRetirando(p);
            }}
          >
            Retirar…
          </OpcionMenu>
        </>
      )}
    </Menu>
  );

  return (
    <>
      <EncabezadoPagina
        antetitulo="Portafolio"
        icono={Package}
        titulo="Productos"
        descripcion="Las soluciones que Crafteech comercializa. Cada producto agrupa sus módulos, funcionalidades y permisos, y se concede a las empresas a través de los planes."
        acciones={
          <Boton variante="primario" icono={<Plus size={14} />} onClick={() => setCreando(true)}>
            Nuevo producto
          </Boton>
        }
        cifras={[
          { etiqueta: "Publicados", valor: numero(cifras.publicados) },
          { etiqueta: "Borradores", valor: numero(cifras.borradores) },
          { etiqueta: "Archivados", valor: numero(cifras.archivados) },
        ]}
      />

      {error && <Aviso>{error}</Aviso>}

      {cargando ? (
        <Esqueleto alto={320} />
      ) : productos.length === 0 ? (
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
        <>
          <div className="emp-filtros">
            <div className="filtros__buscar emp-filtros__buscar">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setPagina(0);
                }}
                placeholder="Buscar por nombre, identificador o categoría…"
                aria-label="Buscar producto"
              />
              {texto && (
                <button type="button" className="emp-filtros__borrar" onClick={() => setTexto("")} aria-label="Borrar búsqueda">
                  <X size={13} />
                </button>
              )}
            </div>
            <select
              className={categoria ? "esta-filtrando" : ""}
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setPagina(0);
              }}
              aria-label="Filtrar por categoría"
            >
              <option value="">Categoría: todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={estado ? "esta-filtrando" : ""}
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value as EstadoComercial | "");
                setPagina(0);
              }}
              aria-label="Filtrar por estado"
            >
              <option value="">Estado: todos</option>
              <option value="ACTIVO">Publicado</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ARCHIVADO">Archivado</option>
            </select>
            {hayFiltros && (
              <button
                type="button"
                className="emp-filtros__limpiar"
                onClick={() => {
                  setTexto("");
                  setCategoria("");
                  setEstado("");
                }}
              >
                <X size={13} aria-hidden="true" /> Limpiar
              </button>
            )}
            <span className="emp-filtros__cuenta" aria-live="polite">
              {numero(visibles.length)} de {numero(cifras.total)}
            </span>
            <SelectorVista vista={vista} onVista={setVista} />
          </div>

          {visibles.length === 0 ? (
            <EstadoVacio icono={Search} titulo="Ningún producto coincide">
              Prueba con otra búsqueda o quita los filtros.
            </EstadoVacio>
          ) : vista === "tabla" ? (
            <div className="marco-tabla">
              <table className="tabla tabla--tarjetas">
                <thead>
                  <tr>
                    {th("nombre", "Producto")}
                    {th("categoria", "Categoría")}
                    {th("estado", "Estado")}
                    {th("permisos", "Permisos", "num")}
                    {th("planes", "Planes", "num")}
                    {th("empresas", "Empresas", "num")}
                    <th className="col-acciones">
                      <span className="oculto">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enPantalla.map((p) => (
                    <tr key={p.id} className="emp-fila" onClick={() => navegar(`/productos/${p.id}`)}>
                      <td className="celda-principal">
                        <Link to={`/productos/${p.id}`} className="prod-nombre" onClick={(e) => e.stopPropagation()}>
                          <span className="prod-icono" aria-hidden="true">
                            <Package size={15} />
                          </span>
                          <span>
                            <strong>{p.nombre}</strong>
                            <code>{p.slug}</code>
                          </span>
                        </Link>
                      </td>
                      <td data-etiqueta="Categoría">{p.categoria || <span className="tenue">Sin categoría</span>}</td>
                      <td data-etiqueta="Estado">
                        <Insignia tono={TONO_ESTADO_PRODUCTO[p.estado]} punto>
                          {ETIQUETA_ESTADO_PRODUCTO[p.estado]}
                        </Insignia>
                      </td>
                      <td className="num" data-etiqueta="Permisos">{numero(p.permisos)}</td>
                      <td className="num" data-etiqueta="Planes">{numero(p.planes)}</td>
                      <td className="num" data-etiqueta="Empresas">{numero(empresas.get(p.id) ?? 0)}</td>
                      <td className="col-acciones" onClick={(e) => e.stopPropagation()}>
                        {acciones(p)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="prod-tarjetas" aria-label="Productos">
              {enPantalla.map((p) => (
                <li key={p.id}>
                  <article className="prod-tarjeta">
                    <header>
                      <Link to={`/productos/${p.id}`} className="prod-nombre">
                        <span className="prod-icono" aria-hidden="true">
                          <Package size={16} />
                        </span>
                        <span>
                          <strong>{p.nombre}</strong>
                          <code>{p.slug}</code>
                        </span>
                      </Link>
                      {acciones(p)}
                    </header>
                    <p className="prod-tarjeta__desc">{p.descripcion || <span className="tenue">Sin descripción.</span>}</p>
                    <div className="prod-tarjeta__etiquetas">
                      <Insignia tono={TONO_ESTADO_PRODUCTO[p.estado]} punto>
                        {ETIQUETA_ESTADO_PRODUCTO[p.estado]}
                      </Insignia>
                      <span className="tenue">{p.categoria || "Sin categoría"}</span>
                    </div>
                    <dl className="prod-tarjeta__datos">
                      <div><dt>Permisos</dt><dd>{numero(p.permisos)}</dd></div>
                      <div><dt>Planes</dt><dd>{numero(p.planes)}</dd></div>
                      <div><dt>Empresas</dt><dd>{numero(empresas.get(p.id) ?? 0)}</dd></div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          )}

          {visibles.length > POR_PAGINA && (
            <nav className="paginacion" aria-label="Paginación">
              <span className="tenue">
                {actual * POR_PAGINA + 1}–{Math.min((actual + 1) * POR_PAGINA, visibles.length)} de {numero(visibles.length)}
              </span>
              <Boton tamano="pequeno" onClick={() => setPagina(actual - 1)} disabled={actual === 0} icono={<ChevronLeft size={14} />} aria-label="Página anterior" />
              <Boton tamano="pequeno" onClick={() => setPagina(actual + 1)} disabled={actual >= paginas - 1} icono={<ChevronRight size={14} />} aria-label="Página siguiente" />
            </nav>
          )}
        </>
      )}

      {creando && (
        <ModalAsistente
          titulo="Nuevo producto"
          descripcion="Una solución que Crafteech comercializa. Nace como borrador."
          trabajando={guardando}
          etiquetaFinal="Crear producto"
          onCerrar={cerrarAlta}
          onFinalizar={crear}
          pasos={[
            {
              id: "datos",
              titulo: "Datos",
              valido: Boolean(nombreNuevo.trim()) && !errorAlta,
              contenido: (
                <>
                  <Campo etiqueta="Nombre" ayuda="Por ejemplo: Commerce, Inventario, Domicilios.">
                    <input
                      autoFocus
                      maxLength={80}
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      aria-invalid={Boolean(errorAlta)}
                    />
                  </Campo>
                  {slugNuevo && !errorAlta && (
                    <p className="tenue text-xs">
                      Identificador: <code>{slugNuevo}</code>
                    </p>
                  )}
                  {errorAlta && <p className="prod-error" role="alert">{errorAlta}</p>}
                  <Campo etiqueta="Categoría" ayuda="Opcional. Agrupa productos: Ventas, Operación, Datos…">
                    <input list="prod-categorias" maxLength={60} value={categoriaNueva} onChange={(e) => setCategoriaNueva(e.target.value)} />
                  </Campo>
                  <datalist id="prod-categorias">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              ),
            },
            {
              id: "descripcion",
              titulo: "Descripción",
              contenido: (
                <>
                  <Campo etiqueta="Descripción" ayuda={`Lo que se lee en la tabla de precios y en el catálogo. Opcional. ${descripcionNueva.length}/255`}>
                    <textarea rows={4} maxLength={255} value={descripcionNueva} onChange={(e) => setDescripcionNueva(e.target.value)} autoFocus />
                  </Campo>
                  <Campo etiqueta="Ícono" ayuda="Opcional. Nombre de un ícono de lucide-react.">
                    <input maxLength={40} value={iconoNuevo} onChange={(e) => setIconoNuevo(e.target.value)} />
                  </Campo>
                </>
              ),
            },
            {
              id: "revision",
              titulo: "Revisión",
              contenido: (
                <>
                  <Resumen
                    filas={[
                      { etiqueta: "Nombre", valor: nombreNuevo.trim() },
                      { etiqueta: "Identificador", valor: <code>{slugNuevo}</code> },
                      { etiqueta: "Categoría", valor: categoriaNueva.trim() },
                      { etiqueta: "Descripción", valor: descripcionNueva.trim() },
                      { etiqueta: "Estado inicial", valor: "Borrador" },
                    ]}
                  />
                  <p className="tenue text-xs">Se publica desde su ficha cuando tenga permisos y planes.</p>
                </>
              ),
            },
          ]}
        />
      )}

      {retirando && (
        <Confirmar
          titulo={`¿Retirar «${retirando.nombre}»?`}
          afecta={`${numero(empresas.get(retirando.id) ?? 0)} empresas · ${numero(retirando.planes)} planes`}
          etiquetaAccion={retirando.permisos > 0 ? "Archivar" : "Eliminar"}
          peligrosa
          trabajando={guardando}
          onCerrar={() => setRetirando(null)}
          onConfirmar={retirar}
          consecuencias={
            retirando.permisos > 0 ? (
              <>
                <p>
                  Queda <strong>archivado</strong> en vez de borrarse: sus permisos se conservan, así que ninguna
                  empresa pierde lo que ya tiene concedido.
                </p>
                {(empresas.get(retirando.id) ?? 0) > 0 && (
                  <p>Las empresas que lo tienen seguirán funcionando; solo deja de ofrecerse en el catálogo.</p>
                )}
              </>
            ) : (
              <p>No tiene permisos asociados ni empresas: se elimina sin dejar rastro.</p>
            )
          }
        />
      )}
    </>
  );
}
