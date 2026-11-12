import { motion } from "motion/react";
import { Check, Package, ShoppingBag, Tags, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Boton } from "../componentes/Boton";
import { Encabezado } from "../componentes/Encabezado";
import { Revelar } from "../componentes/Revelar";
import type { DatosCaminos, Modalidad } from "../contenido/tipos";
import { usarSolucionElegida } from "../lib/solucion";

/**
 * Escena 02. Dos modalidades, dos composiciones: Commerce se enseña como lo
 * que es —un panel que la persona maneja—; Custom, como lo que es —una
 * construcción a medida, con sus piezas conectadas—. Que se vean distintas es
 * la mitad del mensaje: autogestión por un lado, desarrollo a la medida por el
 * otro.
 *
 * Los dibujos son conceptuales y así se rotulan: ni los nombres ni las cifras
 * de ejemplo son de ningún cliente.
 */
export function Caminos({ datos, id }: { datos: DatosCaminos; id: string }) {
  const { solucion } = usarSolucionElegida();

  return (
    <section className="seccion escena--clara caminos" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <div className="caminos__rejilla">
          <Camino modalidad={datos.commerce} lado="commerce" elegida={solucion === "commerce"} visual={<PanelCommerce />} />
          <Camino modalidad={datos.custom} lado="custom" elegida={solucion === "custom"} visual={<PlanoCustom />} />
        </div>
      </div>
    </section>
  );
}

function Camino({
  modalidad,
  lado,
  elegida,
  visual,
}: {
  modalidad: Modalidad;
  lado: "commerce" | "custom";
  elegida: boolean;
  visual: ReactNode;
}) {
  return (
    <Revelar className={`camino camino--${lado} ${elegida ? "es-elegida" : ""}`} desde={44} retraso={lado === "custom" ? 0.12 : 0}>
      <motion.article whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
        <div className="camino__visual">{visual}</div>

        <div className="camino__cuerpo">
          <span className="camino__nombre">{modalidad.nombre}</span>
          <h3 className="camino__frase">{modalidad.frase}</h3>
          <p className="camino__descripcion">{modalidad.descripcion}</p>

          <ul className="camino__beneficios">
            {modalidad.beneficios.map((b) => (
              <li key={b}>
                <Check aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>

          <div className="camino__funciones">
            <span>Incluye</span>
            <ul>
              {modalidad.funciones.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <p className="camino__diferencia">{modalidad.diferencia}</p>

          <Boton enlace={modalidad.cta} variante={lado === "commerce" ? "primario" : "oscuro"} />
        </div>
      </motion.article>
    </Revelar>
  );
}

/** Commerce: el panel desde el que el negocio maneja su tienda. */
function PanelCommerce() {
  const filas = [
    { nombre: "Camisa de lino", precio: "$ 129.000", color: ["#e9e1d5", "#c4b9a9"], presentaciones: "3 presentaciones" },
    { nombre: "Bolso de cuero", precio: "$ 214.000", color: ["#b9946f", "#7a5c40"], presentaciones: "2 presentaciones" },
    { nombre: "Botín clásico", precio: "$ 298.000", color: ["#5d4c3e", "#2c241d"], presentaciones: "4 presentaciones" },
  ];
  return (
    <div className="panel" aria-hidden="true">
      <div className="panel__lateral">
        <span className="panel__item activo">
          <Package /> Productos
        </span>
        <span className="panel__item">
          <Tags /> Categorías
        </span>
        <span className="panel__item">
          <ShoppingBag /> Pedidos
        </span>
        <span className="panel__item">
          <Users /> Clientes
        </span>
      </div>
      <div className="panel__principal">
        <div className="panel__cabecera">
          <strong>Productos</strong>
          <span className="panel__boton">+ Nuevo</span>
        </div>
        {filas.map((f) => (
          <div className="panel__fila" key={f.nombre}>
            <i style={{ background: `linear-gradient(135deg, ${f.color[0]}, ${f.color[1]})` }} />
            <span className="panel__datos">
              <strong>{f.nombre}</strong>
              <small>{f.presentaciones}</small>
            </span>
            <span className="panel__precio">{f.precio}</span>
          </div>
        ))}
        <span className="panel__pedido">
          <ShoppingBag /> Pedido nuevo
        </span>
      </div>
      <span className="visual__nota">Vista conceptual</span>
    </div>
  );
}

/** Custom: una construcción a medida, con sus piezas conectadas. */
function PlanoCustom() {
  return (
    <div className="plano" aria-hidden="true">
      <svg className="plano__lineas" viewBox="0 0 100 60" preserveAspectRatio="none">
        <path d="M24 14 L40 24" />
        <path d="M78 12 L62 24" />
        <path d="M22 48 L40 38" />
        <path d="M80 50 L62 38" />
      </svg>

      <div className="plano__ventana">
        <span className="plano__barra" />
        <span className="plano__bloque plano__bloque--hero" />
        <span className="plano__fila">
          <i />
          <i />
          <i />
        </span>
        <span className="plano__bloque plano__bloque--pie" />
      </div>

      <span className="plano__nodo plano__nodo--a">Diseño exclusivo</span>
      <span className="plano__nodo plano__nodo--b">Integraciones</span>
      <span className="plano__nodo plano__nodo--c">Flujos a medida</span>
      <span className="plano__nodo plano__nodo--d">Tu modelo de negocio</span>
      <span className="visual__nota">Vista conceptual</span>
    </div>
  );
}
