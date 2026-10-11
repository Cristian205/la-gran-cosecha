/**
 * Empresas: el centro de gestión de WORKSPACES.
 *
 * Cada cliente es un entorno propio (su catálogo, sus pedidos y su gente). La
 * pantalla los lista como tabla —para administrar y comparar— o como tarjetas
 * —para explorar y entrar—, sobre los mismos datos y los mismos filtros. Las
 * tres cifras de arriba son contexto: cuántas hay, cuántas operan y cuántas
 * piden algo; la última, además, filtra.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Boxes, Building2 } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { alertasDe, metricas } from "../datos/derivados";
import { numero } from "../datos/formato";
import { Aviso, Boton } from "../ui/basicos";
import { TablaEmpresas } from "../componentes/TablaEmpresas";
import { DialogoAltaNegocio } from "../componentes/DialogoAltaNegocio";
import { tienda, type Plantilla } from "../api/tienda";

export function Negocios() {
  const { negocios, planes, suscripciones, cargando, error } = usarPlataforma();
  const [parametros, setParametros] = useSearchParams();
  const soloAtencion = parametros.get("filtro") === "atencion";
  // `?nueva=1` llega desde el Command Center y el selector de workspace.
  const [dandoAlta, setDandoAlta] = useState(parametros.get("nueva") === "1");
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);

  // Las plantillas solo hacen falta para el alta, así que se piden una vez y
  // en silencio: que fallen no debe impedir ver la lista de clientes.
  useEffect(() => {
    tienda.plantillas().then(setPlantillas).catch(() => setPlantillas([]));
  }, []);

  const cifras = useMemo(
    () => metricas(negocios, planes, suscripciones),
    [negocios, planes, suscripciones]
  );
  const alertas = useMemo(
    () => alertasDe(negocios, planes, suscripciones),
    [negocios, planes, suscripciones]
  );
  const conAlerta = new Set(alertas.map((a) => a.negocioId)).size;

  return (
    <>
      <header className="emp-cabecera">
        <div className="emp-cabecera__texto">
          <p className="emp-cabecera__antetitulo">
            <Boxes size={13} aria-hidden="true" /> Workspaces
          </p>
          <h1>Empresas</h1>
          <p className="tenue">
            Gestiona todos los workspaces de tu ecosistema. Cada cliente tiene su
            catálogo, sus pedidos y su gente, separados del resto.
          </p>
        </div>
        <Boton
          variante="primario"
          icono={<Building2 size={14} />}
          onClick={() => setDandoAlta(true)}
        >
          Nueva empresa
        </Boton>
        <dl className="emp-stats">
          <div>
            <dt>Total</dt>
            <dd>{numero(cifras.empresas)}</dd>
          </div>
          <div>
            <dt>Operativas</dt>
            <dd>{numero(cifras.operativas)}</dd>
          </div>
          <div className={conAlerta ? "emp-stats__aviso" : undefined}>
            <dt>Con avisos</dt>
            <dd>
              {conAlerta > 0 && !soloAtencion ? (
                <button
                  type="button"
                  onClick={() => setParametros({ filtro: "atencion" })}
                  title="Ver solo las empresas que requieren atención"
                >
                  {numero(conAlerta)}
                </button>
              ) : (
                numero(conAlerta)
              )}
            </dd>
          </div>
        </dl>
      </header>

      {error && <Aviso>{error}</Aviso>}

      {soloAtencion && (
        <p className="filtro-activo">
          Mostrando solo las empresas que requieren atención.
          <button type="button" onClick={() => setParametros({})}>
            Ver todas
          </button>
        </p>
      )}

      <TablaEmpresas
        negocios={negocios}
        cargando={cargando}
        soloAtencion={soloAtencion}
        plantillas={plantillas}
      />

      {dandoAlta && (
        <DialogoAltaNegocio
          plantillas={plantillas}
          onCerrar={() => {
            setDandoAlta(false);
            if (parametros.has("nueva")) setParametros({});
          }}
          onCreado={() => {
            setDandoAlta(false);
            if (parametros.has("nueva")) setParametros({});
          }}
        />
      )}
    </>
  );
}
