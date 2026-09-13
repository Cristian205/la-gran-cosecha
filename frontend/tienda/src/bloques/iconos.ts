import { icono3D, type ComponenteIcono } from "./iconos3d";

/**
 * Los iconos que un bloque puede nombrar desde sus propiedades.
 *
 * Es el mismo contrato que el registro de bloques, un nivel más abajo: los
 * datos NOMBRAN («truck») y el código decide qué dibujo es eso. La alternativa
 * —guardar el SVG en la base— ataría el contenido de cada negocio a la librería
 * de iconos que usemos hoy, y cambiarla obligaría a reescribir mil filas.
 *
 * Está aquí, compartido, y no dentro de cada bloque, porque un icono llamado
 * «truck» tiene que ser el mismo camión en la portada, en los pasos y en las
 * insignias. Con un mapa por componente eso dura hasta que alguien añade uno
 * en un sitio y no en el otro.
 *
 * La lista es corta a propósito: son los que el catálogo del backend ofrece
 * hoy. Añadir uno es una línea aquí y una opción más allá.
 *
 * Son renders 3D (Fluent Emoji de Microsoft, MIT, en `/public/icons3d`), no
 * SVG de trazo: por eso son decorativos y no los iconos FUNCIONALES de la
 * tienda (flechas, cerrar, buscar de la barra, estrellas de reseña) — esos
 * siguen en lucide-react porque necesitan seguir el color del tema y no
 * existen en 3D con la misma cobertura.
 */
export const ICONOS: Record<string, ComponenteIcono> = {
  hoja: icono3D("hoja.png"),
  escudo: icono3D("escudo.png"),
  camion: icono3D("camion.png"),
  soporte: icono3D("soporte.png"),
  reloj: icono3D("reloj.png"),
  chispa: icono3D("chispa.png"),
  corazon: icono3D("corazon.png"),
  caja: icono3D("caja.png"),
  canasta: icono3D("canasta.png"),
  lista: icono3D("lista.png"),
  buscar: icono3D("buscar.png"),
  tienda: icono3D("tienda.png"),
  restaurante: icono3D("restaurante.png"),
  cafeteria: icono3D("cafeteria.png"),
  edificio: icono3D("edificio.png"),

  // Los que trajo la plantilla de boutique. Un icono se anade aqui y se puede
  // nombrar desde cualquier bloque: la lista es compartida a proposito, para
  // que «corazon» sea el mismo corazon en la portada, en los pasos y en la
  // barra de categorias.
  flor: icono3D("flor.png"),
  pincel: icono3D("pincel.png"),
  tijeras: icono3D("tijeras.png"),
  gotas: icono3D("gotas.png"),
  bano: icono3D("bano.png"),
  perfume: icono3D("perfume.png"),
  joya: icono3D("joya.png"),
  etiqueta: icono3D("etiqueta.png"),
  descuento: icono3D("descuento.png"),
  conejo: icono3D("conejo.png"),
  candado: icono3D("candado.png"),
  usuario: icono3D("usuario.png"),
  sobre: icono3D("sobre.png"),
  estrella: icono3D("estrella.png"),
  regalo: icono3D("regalo.png"),
};

/**
 * El icono con ese nombre, o uno de respaldo.
 *
 * Nunca devuelve `undefined`: el catálogo del backend y este mapa se despliegan
 * por separado, así que durante unos minutos pueden no coincidir, y una tienda
 * no puede quedarse sin pintar una sección por un nombre que aún no existe.
 * Es el mismo criterio que el registro de bloques aplica a un tipo desconocido.
 */
export function icono(nombre: string | undefined, respaldo: ComponenteIcono = ICONOS.hoja): ComponenteIcono {
  return ICONOS[nombre ?? ""] ?? respaldo;
}
