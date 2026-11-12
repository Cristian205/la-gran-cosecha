/**
 * La pestaña «Productos» de una empresa: qué soluciones tiene y cómo.
 *
 * Una empresa tiene un plan, y el plan concede permisos; los productos son los
 * grupos de esos permisos. Esta pestaña los muestra por producto y permite
 * habilitar o quitar uno COMPLETO para ESTA empresa (como permisos extra o
 * excluidos de su suscripción). Eso no toca el producto, ni el plan, ni a
 * ninguna otra empresa: modificar el catálogo global nunca altera lo pactado.
 *
 * Lo que la plataforma aún no registra (límites por producto, historial de
 * cada asignación) no se simula: se dice en el pie.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import type { Negocio, Plan, Producto, Suscripcion } from "../../api/tipos";
import { usarPlataforma } from "../../datos/plataforma";
import {
  cambiosDePermisos,
  ETIQUETA_ESTADO_PRODUCTO,
  permisosDeProducto,
  productoEnEmpresa,
  TONO_ESTADO_PRODUCTO,
} from "../../datos/productos";
import { Aviso, Boton, EstadoVacio, Insignia, Tarjeta } from "../../ui/basicos";
import { Confirmar } from "../../ui/Modal";
import { usarAviso } from "../../ui/Notificaciones";
import "../../paginas/productos.css";

export function ProductosEmpresa({
  negocio,
  plan,
  suscripcion,
}: {
  negocio: Negocio;
  plan: Plan | null;
  suscripcion: Suscripcion | null;
}) {
  const { productos, permisos, guardarSuscripcion } = usarPlataforma();
  const avisar = usarAviso();
  const [pendiente, setPendiente] = useState<{ producto: Producto; activar: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const filas = useMemo(
    () =>
      productos
        .map((producto) => ({ producto, estado: productoEnEmpresa(producto, permisos, negocio, plan, suscripcion) }))
        // Un borrador o archivado solo se muestra si la empresa ya lo tiene.
        .filter(({ producto, estado }) => producto.estado === "ACTIVO" || estado.concedidos > 0)
        .sort((a, b) => b.estado.concedidos - a.estado.concedidos || a.producto.orden - b.producto.orden),
    [productos, permisos, negocio, plan, suscripcion]
  );

  async function aplicar() {
    if (!pendiente || !suscripcion) return;
    const codenames = permisosDeProducto(pendiente.producto, permisos).map((p) => p.codename);
    setGuardando(true);
    try {
      await guardarSuscripcion(suscripcion.id, cambiosDePermisos(plan, suscripcion, codenames, pendiente.activar));
      avisar(
        pendiente.activar
          ? `«${pendiente.producto.nombre}» habilitado para ${negocio.nombre}.`
          : `«${pendiente.producto.nombre}» quitado de ${negocio.nombre}.`
      );
      setPendiente(null);
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  if (!suscripcion) {
    return (
      <Tarjeta titulo="Productos">
        <EstadoVacio icono={Package} titulo="Sin suscripción">
          Esta empresa no tiene plan: sin él no hay productos que conceder.{" "}
          <Link to={`/empresas/${negocio.id}/suscripcion`}>Asignar un plan</Link>
        </EstadoVacio>
      </Tarjeta>
    );
  }

  return (
    <>
      <Tarjeta titulo="Productos de esta empresa">
        {filas.length === 0 ? (
          <EstadoVacio icono={Package} titulo="No hay productos publicados">
            Crea y publica un producto en <Link to="/productos">Productos</Link>.
          </EstadoVacio>
        ) : (
          <div className="marco-tabla">
            <table className="tabla tabla--tarjetas">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Estado</th>
                  <th>Origen</th>
                  <th>Cobertura</th>
                  <th className="col-acciones">
                    <span className="oculto">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ producto, estado }) => {
                  const extras = estado.concedidos - estado.delPlan;
                  return (
                    <tr key={producto.id}>
                      <td className="celda-principal">
                        <Link to={`/productos/${producto.id}`} className="prod-nombre">
                          <span className="prod-icono" aria-hidden="true">
                            <Package size={14} />
                          </span>
                          <span>
                            <strong>{producto.nombre}</strong>
                            <code>{producto.slug}</code>
                          </span>
                        </Link>
                      </td>
                      <td data-etiqueta="Estado">
                        {estado.cobertura === "completo" && (
                          <Insignia tono="ok" punto>
                            Habilitado
                          </Insignia>
                        )}
                        {estado.cobertura === "parcial" && (
                          <Insignia tono="aviso" punto>
                            Parcial
                          </Insignia>
                        )}
                        {estado.cobertura === "ninguno" && <Insignia tono="neutro">No contratado</Insignia>}
                        {producto.estado !== "ACTIVO" && (
                          <Insignia tono={TONO_ESTADO_PRODUCTO[producto.estado]}>
                            {ETIQUETA_ESTADO_PRODUCTO[producto.estado]}
                          </Insignia>
                        )}
                      </td>
                      <td data-etiqueta="Origen">
                        {estado.concedidos === 0 ? (
                          <span className="tenue">—</span>
                        ) : (
                          <>
                            {estado.delPlan > 0 && <span>Plan {plan?.nombre}</span>}
                            {extras > 0 && (
                              <span className="tenue">
                                {estado.delPlan > 0 ? " + " : ""}
                                {extras} extra
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td data-etiqueta="Cobertura">
                        {estado.concedidos} de {estado.total} permisos
                      </td>
                      <td className="col-acciones">
                        {estado.cobertura === "completo" ? (
                          <Boton tamano="pequeno" variante="peligro" onClick={() => setPendiente({ producto, activar: false })}>
                            Quitar
                          </Boton>
                        ) : (
                          <Boton
                            tamano="pequeno"
                            disabled={estado.total === 0 || producto.estado !== "ACTIVO"}
                            title={estado.total === 0 ? "El producto no tiene permisos activos" : undefined}
                            onClick={() => setPendiente({ producto, activar: true })}
                          >
                            {estado.cobertura === "parcial" ? "Completar" : "Habilitar"}
                          </Boton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="tenue text-xs prod-nota">
          Habilitar o quitar un producto cambia solo a esta empresa, como permisos extra o excluidos de su suscripción.
          Los límites por producto y el historial de cada asignación todavía no se registran.
        </p>
      </Tarjeta>

      {pendiente && (
        <Confirmar
          titulo={pendiente.activar ? `¿Habilitar «${pendiente.producto.nombre}»?` : `¿Quitar «${pendiente.producto.nombre}»?`}
          afecta={negocio.nombre}
          etiquetaAccion={pendiente.activar ? "Habilitar" : "Quitar"}
          peligrosa={!pendiente.activar}
          trabajando={guardando}
          onCerrar={() => setPendiente(null)}
          onConfirmar={aplicar}
          consecuencias={
            pendiente.activar ? (
              <p>La empresa recibe todos los permisos activos de este producto. Lo que ya tuviera por su plan no cambia.</p>
            ) : (
              <>
                <p>La empresa deja de tener todos los permisos de este producto, aunque su plan los incluya.</p>
                <Aviso tono="aviso">Sus usuarios perderán acceso a esas funciones de inmediato.</Aviso>
              </>
            )
          }
        />
      )}
    </>
  );
}
