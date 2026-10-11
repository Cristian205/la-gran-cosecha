/**
 * El logo de la marca convertido en selector de workspace.
 *
 * Arriba, las marcas que esta instalación sabe vestir: elegir una la publica
 * en el panel entero. Debajo, las empresas de la plataforma, que son los
 * workspaces a los que se entra desde aquí. Al final, crear uno nuevo, que
 * abre el alta de empresa de siempre.
 */
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usarPlataforma } from "../datos/plataforma";
import { TONO_ESTADO, ETIQUETA_ESTADO } from "../datos/derivados";
import { usarMarca } from "../marca/ProveedorMarca";
import { inicialesMarca } from "../marca/motor";
import type { Marca } from "../marca/tipos";
import { Desplegable } from "../ui/Desplegable";
import { AvatarEmpresa } from "./empresas/piezas";

export function LogoMarca({ marca, conNombre = true }: { marca: Marca; conNombre?: boolean }) {
  return (
    <span className="logo-marca">
      {marca.logo ? (
        <img className="logo-marca__imagen" src={marca.logo} alt="" />
      ) : (
        <span className="logo-marca__iniciales" aria-hidden="true">
          {inicialesMarca(marca.nombre)}
        </span>
      )}
      {conNombre && <NombreMarca marca={marca} />}
    </span>
  );
}

/** Kryon X se escribe como su logotipo; las demás marcas, en su color. */
export function NombreMarca({ marca }: { marca: Marca }) {
  if (marca.logotipoMetalico) {
    const [inicio, ...resto] = marca.nombre.toUpperCase().split(" ");
    return (
      <span className="nombre-marca nombre-marca--metalico">
        {inicio} {resto.length > 0 && <b>{resto.join(" ")}</b>}
      </span>
    );
  }
  return <span className="nombre-marca">{marca.nombre}</span>;
}

export function SelectorMarca({ plegado }: { plegado: boolean }) {
  const { marcas, activa, publicar } = usarMarca();
  const { negocios } = usarPlataforma();
  const navegar = useNavigate();

  return (
    <Desplegable
      etiqueta="Cambiar de marca o de workspace"
      alineacion="izquierda"
      lado={plegado ? "lateral" : "abajo"}
      ancho={284}
      claseDisparador="selector-marca"
      disparador={
        <>
          <LogoMarca marca={activa} conNombre={false} />
          <span className="selector-marca__textos">
            <NombreMarca marca={activa} />
            <span className="selector-marca__lema">{activa.lema}</span>
          </span>
          <ChevronsUpDown size={14} className="selector-marca__flechas" />
        </>
      }
    >
      {(cerrar) => (
        <div className="workspaces">
          <p className="workspaces__titulo">Marcas</p>
          {marcas.map((marca) => (
            <button
              key={marca.id}
              type="button"
              className="workspaces__fila"
              onClick={() => {
                publicar(marca.id);
                cerrar();
              }}
            >
              <LogoMarca marca={marca} conNombre={false} />
              <span className="workspaces__textos">
                <strong>{marca.nombre}</strong>
                <span>{marca.lema}</span>
              </span>
              {marca.id === activa.id && <Check size={15} className="workspaces__marca" />}
            </button>
          ))}

          {negocios.length > 0 && (
            <>
              <hr className="workspaces__separador" />
              <p className="workspaces__titulo">Empresas</p>
              <div className="workspaces__lista">
                {negocios.map((negocio) => (
                  <button
                    key={negocio.id}
                    type="button"
                    className="workspaces__fila"
                    onClick={() => {
                      cerrar();
                      navegar(`/empresas/${negocio.id}`);
                    }}
                  >
                    <AvatarEmpresa negocio={negocio} tamano="s" />
                    <span className="workspaces__textos">
                      <strong>{negocio.nombre}</strong>
                      <span>{negocio.plan?.nombre ?? "Sin plan"}</span>
                    </span>
                    <i
                      className={`punto-estado punto-estado--${TONO_ESTADO[negocio.estado]}`}
                      title={ETIQUETA_ESTADO[negocio.estado]}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          <hr className="workspaces__separador" />
          <button
            type="button"
            className="workspaces__fila workspaces__fila--crear"
            onClick={() => {
              cerrar();
              navegar("/empresas?nueva=1");
            }}
          >
            <span className="workspaces__mas" aria-hidden="true">
              <Plus size={14} />
            </span>
            <span className="workspaces__textos">
              <strong>Crear workspace</strong>
              <span>Da de alta una empresa nueva</span>
            </span>
          </button>
        </div>
      )}
    </Desplegable>
  );
}
