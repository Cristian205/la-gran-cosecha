/**
 * El listado de clientes.
 *
 * La pantalla es casi toda tabla a propósito: aquí se viene a encontrar una
 * empresa concreta entre muchas, no a leer indicadores. Las tres cifras de
 * arriba son las que cambian lo que se busca —cuántas hay, cuántas están
 * paradas, cuántas piden algo— y nada más.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2 } from "lucide-react";
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
  const [dandoAlta, setDandoAlta] = useState(false);
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
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Empresas</h1>
          <p className="tenue">
            Cada cliente tiene su catálogo, sus pedidos y su gente, completamente
            separados del resto. Desde aquí se decide su plan y su estado.
          </p>
        </div>
        <div className="ficha__acciones">
          <Boton
            variante="primario"
            icono={<Building2 size={14} />}
            onClick={() => setDandoAlta(true)}
          >
            Nueva empresa
          </Boton>
        </div>
        <dl className="resumen-linea">
          <div>
            <dt>Total</dt>
            <dd>{numero(cifras.empresas)}</dd>
          </div>
          <div>
            <dt>Operativas</dt>
            <dd>{numero(cifras.operativas)}</dd>
          </div>
          <div>
            <dt>Con avisos</dt>
            <dd className={conAlerta ? "es-aviso" : undefined}>{numero(conAlerta)}</dd>
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
          onCerrar={() => setDandoAlta(false)}
          onCreado={() => setDandoAlta(false)}
        />
      )}
    </>
  );
}
