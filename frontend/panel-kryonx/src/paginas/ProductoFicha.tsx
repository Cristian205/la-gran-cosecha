/**
 * La ficha de un producto: se administra por secciones, no en un formulario
 * interminable.
 *
 *   General · Módulos · Funcionalidades · Permisos · Planes y precios ·
 *   Empresas · Versiones
 *
 * El borrador de «General» vive aquí arriba y no en la pestaña: se puede ir a
 * mirar los permisos sin perder lo que se estaba editando, y la cabecera
 * avisa de que hay cambios sin guardar.
 *
 * Producto → Módulos → Funcionalidades → Permisos son cosas distintas y cada
 * pestaña muestra una sola. Qué empresas lo tienen y qué planes lo conceden se
 * DEDUCE (ver `datos/productos.ts`); no hay todavía una asignación explícita.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Boxes, Building2, Layers, Package, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { api } from "../api/cliente";
import type { Caracteristica, Plan, Producto } from "../api/tipos";
import { ETIQUETA_SUSCRIPCION, TONO_SUSCRIPCION } from "../datos/derivados";
import { moneda, numero } from "../datos/formato";
import { usarPlataforma } from "../datos/plataforma";
import {
  empresasDeProducto,
  ETIQUETA_ESTADO_PRODUCTO,
  permisosDeProducto,
  planesDeProducto,
  TONO_ESTADO_PRODUCTO,
} from "../datos/productos";
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto, Insignia, Tarjeta } from "../ui/basicos";
import { Confirmar } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";
import { EstadoEmpresa } from "../componentes/piezas";
import { AvatarEmpresa } from "../componentes/empresas/piezas";
import "./productos.css";

const PESTANAS = [
  { ruta: "", etiqueta: "General" },
  { ruta: "modulos", etiqueta: "Módulos" },
  { ruta: "funcionalidades", etiqueta: "Funcionalidades" },
  { ruta: "permisos", etiqueta: "Permisos" },
  { ruta: "planes", etiqueta: "Planes y precios" },
  { ruta: "empresas", etiqueta: "Empresas" },
  { ruta: "versiones", etiqueta: "Versiones" },
];

export function ProductoFicha() {
  const { id, pestana = "" } = useParams();
  const { productos, permisos, negocios, planes, suscripciones, cargando, guardarProducto, archivarProducto } =
    usarPlataforma();
  const avisar = usarAviso();
  const navegar = useNavigate();

  const producto = productos.find((p) => String(p.id) === id) ?? null;
  const [borrador, setBorrador] = useState<Producto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [retirando, setRetirando] = useState(false);

  // El borrador se rehace solo cuando cambia de producto o el servidor devuelve
  // otra versión: no al teclear.
  useEffect(() => {
    setBorrador(producto ? { ...producto } : null);
  }, [producto]);

  const sucio = useMemo(() => {
    if (!borrador || !producto) return false;
    return (["nombre", "descripcion", "categoria", "icono", "estado", "orden"] as const).some(
      (k) => borrador[k] !== producto[k]
    );
  }, [borrador, producto]);

  // Avisar si se cierra la pestaña del navegador con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sucio]);

  const propios = useMemo(() => (producto ? permisosDeProducto(producto, permisos) : []), [producto, permisos]);
  const empresas = useMemo(
    () => (producto ? empresasDeProducto(producto, permisos, negocios, planes, suscripciones) : []),
    [producto, permisos, negocios, planes, suscripciones]
  );
  const susPlanes = useMemo(() => (producto ? planesDeProducto(producto, planes) : []), [producto, planes]);

  if (cargando) return <Esqueleto alto={360} />;
  if (!producto || !borrador) {
    return (
      <EstadoVacio titulo="Ese producto no existe" accion={<Link to="/productos">Volver a Productos</Link>}>
        Puede que se haya eliminado o que el enlace esté desactualizado.
      </EstadoVacio>
    );
  }

  const nombreRepetido =
    borrador.nombre.trim().length > 0 &&
    productos.some((p) => p.id !== producto.id && p.nombre.trim().toLowerCase() === borrador.nombre.trim().toLowerCase());
  const errorNombre = !borrador.nombre.trim() ? "El nombre es obligatorio." : nombreRepetido ? "Ya existe otro producto con ese nombre." : null;

  // Publicar un producto sin permisos lo deja vacío: se avisa, no se impide.
  const publicandoVacio = borrador.estado === "ACTIVO" && propios.length === 0;

  async function guardar() {
    if (!borrador || errorNombre) return;
    setGuardando(true);
    try {
      await guardarProducto(borrador.id, {
        nombre: borrador.nombre.trim(),
        descripcion: borrador.descripcion,
        categoria: borrador.categoria.trim(),
        icono: borrador.icono.trim(),
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

  async function retirar() {
    if (!producto) return;
    setGuardando(true);
    try {
      await archivarProducto(producto);
      avisar(producto.permisos > 0 ? "Producto archivado." : "Producto eliminado.");
      setRetirando(false);
      navegar("/productos");
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  function volver(e: React.MouseEvent) {
    if (sucio && !window.confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?")) e.preventDefault();
  }

  return (
    <>
      <Link to="/productos" className="volver" onClick={volver}>
        <ArrowLeft size={14} /> Productos
      </Link>

      <header className="ficha prod-ficha">
        <span className="prod-icono prod-icono--grande" aria-hidden="true">
          <Package size={22} />
        </span>
        <div className="ficha__identidad">
          <h1>{producto.nombre}</h1>
          <p className="ficha__meta">
            <code>{producto.slug}</code>
            <Insignia tono={TONO_ESTADO_PRODUCTO[producto.estado]} punto>
              {ETIQUETA_ESTADO_PRODUCTO[producto.estado]}
            </Insignia>
            <span className="tenue">{producto.categoria || "Sin categoría"}</span>
          </p>
        </div>
        <div className="ficha__acciones">
          {sucio && (
            <span className="prod-pendiente" role="status">
              <i aria-hidden="true" /> Cambios sin guardar
            </span>
          )}
          <Boton
            variante="peligro"
            tamano="pequeno"
            icono={<Trash2 size={13} />}
            disabled={producto.estado === "ARCHIVADO"}
            onClick={() => setRetirando(true)}
          >
            Retirar
          </Boton>
          <Boton variante="primario" icono={<Save size={14} />} cargando={guardando} disabled={!sucio || Boolean(errorNombre)} onClick={guardar}>
            Guardar
          </Boton>
        </div>
      </header>

      <nav className="pestanas" aria-label="Secciones del producto">
        {PESTANAS.map((p) => (
          <NavLink key={p.ruta} end={p.ruta === ""} to={`/productos/${producto.id}${p.ruta ? `/${p.ruta}` : ""}`}>
            {p.etiqueta}
          </NavLink>
        ))}
      </nav>

      {pestana === "" && (
        <General
          borrador={borrador}
          onCambiar={(c) => setBorrador({ ...borrador, ...c })}
          errorNombre={errorNombre}
          publicandoVacio={publicandoVacio}
          categorias={[...new Set(productos.map((p) => p.categoria.trim()).filter(Boolean))]}
        />
      )}
      {pestana === "modulos" && <Modulos propios={propios} />}
      {pestana === "funcionalidades" && <Funcionalidades producto={producto} />}
      {pestana === "permisos" && <PermisosTab propios={propios} total={permisos.filter((p) => p.producto === producto.id).length} />}
      {pestana === "planes" && <PlanesTab planes={susPlanes} />}
      {pestana === "empresas" && <EmpresasTab empresas={empresas} />}
      {pestana === "versiones" && <Versiones planes={susPlanes} />}
      {!PESTANAS.some((p) => p.ruta === pestana) && <Navigate to={`/productos/${producto.id}`} replace />}

      {retirando && (
        <Confirmar
          titulo={`¿Retirar «${producto.nombre}»?`}
          afecta={`${numero(empresas.length)} empresas · ${numero(susPlanes.length)} planes`}
          etiquetaAccion={producto.permisos > 0 ? "Archivar" : "Eliminar"}
          peligrosa
          trabajando={guardando}
          onCerrar={() => setRetirando(false)}
          onConfirmar={retirar}
          consecuencias={
            producto.permisos > 0 ? (
              <p>
                Queda <strong>archivado</strong>: sus permisos se conservan y las empresas que lo tienen no pierden
                nada. Solo deja de ofrecerse en el catálogo.
              </p>
            ) : (
              <p>No tiene permisos ni empresas: se elimina sin dejar rastro.</p>
            )
          }
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ General */

function General({
  borrador,
  onCambiar,
  errorNombre,
  publicandoVacio,
  categorias,
}: {
  borrador: Producto;
  onCambiar: (c: Partial<Producto>) => void;
  errorNombre: string | null;
  publicandoVacio: boolean;
  categorias: string[];
}) {
  return (
    <Tarjeta titulo="Datos generales">
      <div className="prod-formulario">
        <Campo etiqueta="Nombre">
          <input value={borrador.nombre} maxLength={80} onChange={(e) => onCambiar({ nombre: e.target.value })} aria-invalid={Boolean(errorNombre)} />
          {errorNombre && <span className="prod-error" role="alert">{errorNombre}</span>}
        </Campo>
        <Campo etiqueta="Identificador" ayuda="No se puede cambiar: lo usan los planes y los permisos.">
          <input value={borrador.slug} readOnly disabled />
        </Campo>
        <div className="prod-formulario__ancho">
          <Campo etiqueta="Descripción" ayuda={`Lo que se lee en la tabla de precios y en el catálogo. ${borrador.descripcion.length}/255`}>
            <textarea rows={3} maxLength={255} value={borrador.descripcion} onChange={(e) => onCambiar({ descripcion: e.target.value })} />
          </Campo>
        </div>
        <Campo etiqueta="Categoría" ayuda="Agrupa productos: Ventas, Operación, Datos…">
          <input list="prod-categorias-ficha" maxLength={60} value={borrador.categoria} onChange={(e) => onCambiar({ categoria: e.target.value })} />
          <datalist id="prod-categorias-ficha">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Ícono" ayuda="Nombre de un ícono de lucide-react; el panel de cada negocio resuelve el dibujo.">
          <input value={borrador.icono} maxLength={40} onChange={(e) => onCambiar({ icono: e.target.value })} />
        </Campo>
        <Campo etiqueta="Estado">
          <select value={borrador.estado} onChange={(e) => onCambiar({ estado: e.target.value as Producto["estado"] })}>
            <option value="BORRADOR">Borrador — no se ofrece</option>
            <option value="ACTIVO">Publicado — disponible en el catálogo</option>
            <option value="ARCHIVADO">Archivado — retirado del catálogo</option>
          </select>
        </Campo>
        <Campo etiqueta="Orden" ayuda="Posición en las listas; menor va primero.">
          <input type="number" min={0} value={borrador.orden} onChange={(e) => onCambiar({ orden: Math.max(0, Number(e.target.value) || 0) })} />
        </Campo>
      </div>
      {publicandoVacio && (
        <Aviso tono="aviso">
          Vas a publicar un producto sin permisos: ningún plan podrá concederlo hasta que se le asocien en Permisos.
        </Aviso>
      )}
      <p className="tenue text-xs prod-nota">
        La imagen del producto todavía no existe en la plataforma: no hay dónde guardarla. Está en la propuesta de
        evolución (<code>docs/PRODUCTOS-Y-EMPRESAS.md</code>).
      </p>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ Módulos */

function Modulos({ propios }: { propios: ReturnType<typeof permisosDeProducto> }) {
  const grupos = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of propios) m.set(p.modulo, (m.get(p.modulo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [propios]);

  return (
    <Tarjeta
      titulo="Módulos que componen el producto"
      accion={<Link to="/permisos" className="prod-enlace">Gestionar en Permisos</Link>}
    >
      {grupos.length === 0 ? (
        <EstadoVacio icono={Boxes} titulo="Sin módulos todavía">
          Un módulo aparece cuando se da de alta un permiso de este producto con ese nombre de módulo.
        </EstadoVacio>
      ) : (
        <>
          <ul className="prod-lista">
            {grupos.map(([nombre, cuantos]) => (
              <li key={nombre}>
                <span className="prod-icono" aria-hidden="true"><Boxes size={14} /></span>
                <strong>{nombre}</strong>
                <span className="tenue">{cuantos} {cuantos === 1 ? "permiso" : "permisos"}</span>
              </li>
            ))}
          </ul>
          <p className="tenue text-xs prod-nota">
            Hoy un módulo es el nombre con el que se agrupan los permisos del producto; no tiene ficha propia.
          </p>
        </>
      )}
    </Tarjeta>
  );
}

/* ---------------------------------------------------------- Funcionalidades */

function Funcionalidades({ producto }: { producto: Producto }) {
  const [lista, setLista] = useState<Caracteristica[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<Caracteristica[]>("/platform/features/")
      .then((r) => vivo && setLista(r.filter((c) => c.producto === producto.id)))
      .catch((e: Error) => vivo && setFallo(e.message));
    return () => {
      vivo = false;
    };
  }, [producto.id]);

  return (
    <Tarjeta titulo="Funcionalidades" accion={<Link to="/planes" className="prod-enlace">Asignarlas desde Planes</Link>}>
      {fallo ? (
        <Aviso>{fallo}</Aviso>
      ) : lista === null ? (
        <Esqueleto alto={120} />
      ) : lista.length === 0 ? (
        <EstadoVacio icono={Sparkles} titulo="Sin funcionalidades asociadas">
          Una funcionalidad es lo que un plan promete y no es un permiso: soporte, API, SLA.
        </EstadoVacio>
      ) : (
        <ul className="prod-lista">
          {lista.map((c) => (
            <li key={c.id}>
              <span className="prod-icono" aria-hidden="true"><Sparkles size={14} /></span>
              <span>
                <strong>{c.nombre}</strong>
                {c.descripcion && <span className="tenue prod-lista__desc">{c.descripcion}</span>}
              </span>
              <code>{c.codigo}</code>
              <Insignia tono={c.activo ? "ok" : "neutro"}>{c.activo ? "Activa" : "Inactiva"}</Insignia>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ----------------------------------------------------------------- Permisos */

function PermisosTab({ propios, total }: { propios: ReturnType<typeof permisosDeProducto>; total: number }) {
  return (
    <Tarjeta
      titulo="Permisos y acciones"
      accion={<Link to="/permisos" className="prod-enlace">Gestionar en Permisos</Link>}
    >
      {propios.length === 0 ? (
        <EstadoVacio icono={ShieldCheck} titulo="Sin permisos activos">
          Los permisos se crean en Permisos eligiendo este producto.
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla tabla--tarjetas">
            <thead>
              <tr>
                <th>Permiso</th>
                <th>Módulo</th>
                <th>Código</th>
              </tr>
            </thead>
            <tbody>
              {propios.map((p) => (
                <tr key={p.id}>
                  <td className="celda-principal">
                    <strong>{p.etiqueta || p.codename}</strong>
                    {p.descripcion && <span className="tenue prod-lista__desc">{p.descripcion}</span>}
                  </td>
                  <td data-etiqueta="Módulo">{p.modulo}</td>
                  <td data-etiqueta="Código"><code>{p.codename}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > propios.length && (
        <p className="tenue text-xs prod-nota">
          {total - propios.length} {total - propios.length === 1 ? "permiso inactivo no se muestra" : "permisos inactivos no se muestran"}.
        </p>
      )}
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------- Planes */

function PlanesTab({ planes }: { planes: Plan[] }) {
  return (
    <Tarjeta titulo="Planes que lo conceden" accion={<Link to="/planes" className="prod-enlace">Abrir Planes</Link>}>
      {planes.length === 0 ? (
        <EstadoVacio icono={Layers} titulo="Ningún plan lo concede">
          Para que una empresa lo tenga, marca sus permisos en algún plan.
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla tabla--tarjetas">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Estado</th>
                <th className="num">Precio mensual</th>
                <th>Límites</th>
                <th className="num">Empresas</th>
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id}>
                  <td className="celda-principal">
                    <strong>{p.nombre}</strong> <span className="tenue">v{p.version}</span>
                  </td>
                  <td data-etiqueta="Estado">
                    <Insignia tono={TONO_ESTADO_PRODUCTO[p.estado]} punto>{ETIQUETA_ESTADO_PRODUCTO[p.estado]}</Insignia>
                  </td>
                  <td className="num" data-etiqueta="Precio mensual">
                    {Number(p.precio_mensual) > 0 ? moneda(p.precio_mensual, p.moneda) : <span className="tenue">sin precio</span>}
                  </td>
                  <td data-etiqueta="Límites">
                    {Object.entries(p.limites_efectivos).filter(([, l]) => l.propio).length === 0 ? (
                      <span className="tenue">por defecto</span>
                    ) : (
                      Object.entries(p.limites_efectivos)
                        .filter(([, l]) => l.propio)
                        .map(([k, l]) => `${k.replace(/^max_/, "")}: ${l.valor ?? "∞"}`)
                        .join(" · ")
                    )}
                  </td>
                  <td className="num" data-etiqueta="Empresas">{numero(p.negocios)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tenue text-xs prod-nota">
        Los precios y límites son del plan, no del producto: así cambiar la tarifa de un plan no reescribe lo que ya
        pactó cada empresa.
      </p>
    </Tarjeta>
  );
}

/* ----------------------------------------------------------------- Empresas */

function EmpresasTab({ empresas }: { empresas: ReturnType<typeof empresasDeProducto> }) {
  return (
    <Tarjeta titulo={`Empresas que lo tienen (${empresas.length})`} accion={<Link to="/empresas" className="prod-enlace">Abrir Empresas</Link>}>
      {empresas.length === 0 ? (
        <EstadoVacio icono={Building2} titulo="Ninguna empresa lo tiene">
          Se deduce del plan de cada empresa y de los permisos que se le hayan concedido o quitado.
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla tabla--tarjetas">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Estado</th>
                <th>Plan</th>
                <th>Cobertura</th>
                <th>Suscripción</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.negocio.id}>
                  <td className="celda-principal">
                    <Link to={`/empresas/${e.negocio.id}/modulos`} className="prod-nombre">
                      <AvatarEmpresa negocio={e.negocio} tamano="s" />
                      <span>
                        <strong>{e.negocio.nombre}</strong>
                        <code>{e.negocio.slug}</code>
                      </span>
                    </Link>
                  </td>
                  <td data-etiqueta="Estado"><EstadoEmpresa estado={e.negocio.estado} /></td>
                  <td data-etiqueta="Plan">{e.plan?.nombre ?? <span className="tenue">sin plan</span>}</td>
                  <td data-etiqueta="Cobertura">
                    {e.concedidos} de {e.total} permisos
                    {e.cobertura === "parcial" && <Insignia tono="aviso">Parcial</Insignia>}
                    {e.concedidos > e.delPlan && <span className="tenue"> · {e.concedidos - e.delPlan} extra</span>}
                  </td>
                  <td data-etiqueta="Suscripción">
                    {e.suscripcion ? (
                      <Insignia tono={TONO_SUSCRIPCION[e.suscripcion.estado]} punto>
                        {ETIQUETA_SUSCRIPCION[e.suscripcion.estado]}
                      </Insignia>
                    ) : (
                      <span className="tenue">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

/* ----------------------------------------------------------------- Versiones */

function Versiones({ planes }: { planes: Plan[] }) {
  return (
    <Tarjeta titulo="Versiones">
      <div className="prod-versiones-aviso" role="note">
        <AlertTriangle size={16} aria-hidden="true" />
        <p>
          Los productos todavía no guardan historial de versiones: lo que cambia hoy se sobrescribe. Lo que sí
          versiona la plataforma son los <strong>planes</strong>, que es lo que protege a quien ya contrató. La
          propuesta para versionar el producto está en <code>docs/PRODUCTOS-Y-EMPRESAS.md</code>.
        </p>
      </div>
      {planes.length > 0 && (
        <>
          <h3 className="prod-subtitulo">Versiones de los planes que lo incluyen</h3>
          <ul className="prod-lista">
            {[...planes]
              .sort((a, b) => a.nombre.localeCompare(b.nombre) || b.version - a.version)
              .map((p) => (
                <li key={p.id}>
                  <strong>{p.nombre}</strong>
                  <span className="tenue">versión {p.version}</span>
                  <Insignia tono={TONO_ESTADO_PRODUCTO[p.estado]} punto>{ETIQUETA_ESTADO_PRODUCTO[p.estado]}</Insignia>
                  <span className="tenue">{numero(p.negocios)} {p.negocios === 1 ? "empresa" : "empresas"}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}
