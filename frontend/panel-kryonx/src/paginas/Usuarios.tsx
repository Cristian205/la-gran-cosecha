/**
 * Usuarios: todas las personas con acceso a alguna empresa.
 *
 * La API sirve los equipos por empresa; aquí se ven juntos para responder
 * preguntas que cruzan clientes («¿en qué empresas está este correo?»). Es de
 * solo lectura: los usuarios los crea y gestiona cada negocio desde su panel,
 * y la plataforma no los toca.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ShieldCheck, Users as IconoUsuarios } from "lucide-react";
import { usarEquipos } from "../datos/equipos";
import { iniciales, numero } from "../datos/formato";
import { Aviso, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { EncabezadoPagina } from "../componentes/piezas";

export function Usuarios() {
  const { filas, cargando, error } = usarEquipos();
  const [parametros] = useSearchParams();
  const [texto, setTexto] = useState(parametros.get("q") ?? "");

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((m) =>
      `${m.nombre} ${m.email} ${m.negocio} ${m.rol}`.toLowerCase().includes(q)
    );
  }, [filas, texto]);

  const activos = filas.filter((m) => m.activo).length;
  const empresas = new Set(filas.map((m) => m.negocioId)).size;

  return (
    <>
      <EncabezadoPagina
        antetitulo="Negocio"
        titulo="Usuarios"
        descripcion="Las personas con acceso a cada empresa. Cada negocio los gestiona desde su propio panel; aquí se consultan."
      >
        <dl className="resumen-linea">
          <div>
            <dt>Usuarios</dt>
            <dd>{numero(filas.length)}</dd>
          </div>
          <div>
            <dt>Activos</dt>
            <dd>{numero(activos)}</dd>
          </div>
          <div>
            <dt>Empresas</dt>
            <dd>{numero(empresas)}</dd>
          </div>
        </dl>
      </EncabezadoPagina>

      {error && <Aviso>{error}</Aviso>}

      <div className="filtros">
        <div className="filtros__buscar">
          <Search size={15} />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, correo, empresa o rol…"
            aria-label="Buscar usuario"
          />
        </div>
        <span className="filtros__cuenta">
          {numero(visibles.length)} de {numero(filas.length)}
        </span>
      </div>

      {cargando ? (
        <div className="marco-tabla">
          <div className="esqueleto-tabla">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="esqueleto-tabla__fila">
                <Esqueleto alto={28} ancho={28} radio={8} />
                <Esqueleto alto={12} ancho="30%" />
                <Esqueleto alto={12} ancho="20%" />
                <Esqueleto alto={12} ancho="14%" />
              </div>
            ))}
          </div>
        </div>
      ) : visibles.length === 0 ? (
        <EstadoVacio icono={IconoUsuarios} titulo={filas.length ? "Nadie coincide" : "Todavía no hay usuarios"}>
          {filas.length
            ? "Prueba con otro nombre, correo o empresa."
            : "Cuando una empresa invite a su equipo, aparecerá aquí."}
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla tabla--tarjetas">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Empresa</th>
                <th>Rol</th>
                <th>Acceso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={`${m.negocioId}-${m.email}`}>
                  <td className="celda-principal">
                    <span className="empresa">
                      <span className="avatar-empresa avatar-empresa--persona" aria-hidden="true">
                        {iniciales(m.nombre || m.email)}
                      </span>
                      <span>
                        <span className="empresa__nombre">{m.nombre || "Sin nombre"}</span>
                        <span className="empresa__sub">{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-etiqueta="Empresa">
                    <Link to={`/empresas/${m.negocioId}/usuarios`} className="enlace-tabla">
                      {m.negocio}
                    </Link>
                  </td>
                  <td data-etiqueta="Rol">{m.rol || <span className="tenue">—</span>}</td>
                  <td data-etiqueta="Acceso">
                    {m.tiene_acceso_total ? (
                      <Insignia tono="info">
                        <ShieldCheck size={12} /> Total
                      </Insignia>
                    ) : (
                      <span className="tenue">{m.permisos.length} permisos</span>
                    )}
                  </td>
                  <td data-etiqueta="Estado">
                    <Insignia tono={m.activo ? "ok" : "neutro"} punto>
                      {m.activo ? "Activo" : "Inactivo"}
                    </Insignia>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
