import { Check } from "lucide-react";
import { Boton } from "../componentes/Boton";
import { Encabezado } from "../componentes/Encabezado";
import { Revelar } from "../componentes/Revelar";
import type { DatosSoluciones } from "../contenido/tipos";
import { usarSolucionElegida } from "../lib/solucion";

/**
 * Escena 07. Tres formas de trabajar con Crafteech y la diferencia entre ellas
 * dicha sin rodeos: una SUSCRIPCIÓN (Commerce), un DESARROLLO A LA MEDIDA
 * (Custom) y un ACOMPAÑAMIENTO RECURRENTE (Growth). Cada plan lleva su propia
 * etiqueta de modelo, porque es lo que alguien necesita entender antes de
 * escribir.
 *
 * No hay precios: no están definidos. Cada plan lleva a una cotización y la
 * nota lo dice. Cuando existan, son un campo más de `Plan` y esta escena no
 * cambia de forma.
 */
export function Soluciones({ datos, id }: { datos: DatosSoluciones; id: string }) {
  const { solucion } = usarSolucionElegida();

  return (
    <section className="seccion escena--clara soluciones" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <ul className="planes">
          {datos.planes.map((plan, i) => (
            <li key={plan.solucion} className="plan__celda">
              <Revelar retraso={i * 0.1} desde={40}>
                <article
                  className={`plan ${plan.destacado ? "plan--destacado" : ""} ${solucion === plan.solucion ? "es-elegida" : ""}`}
                  aria-labelledby={`${id}-${plan.solucion}`}
                >
                  <span className="plan__modelo">{plan.modelo}</span>
                  <h3 className="plan__nombre" id={`${id}-${plan.solucion}`}>
                    Crafteech <strong>{plan.nombre}</strong>
                  </h3>
                  <p className="plan__descripcion">{plan.descripcion}</p>
                  <ul className="plan__incluye">
                    {plan.incluye.map((item) => (
                      <li key={item}>
                        <Check aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Boton enlace={plan.cta} variante={plan.destacado ? "primario" : "oscuro"} />
                </article>
              </Revelar>
            </li>
          ))}
        </ul>

        <Revelar retraso={0.2}>
          <p className="soluciones__nota">{datos.nota}</p>
        </Revelar>
      </div>
    </section>
  );
}
