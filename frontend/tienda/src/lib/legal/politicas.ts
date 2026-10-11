import type { Politica } from "./tipos";

/**
 * El texto por defecto de cada política.
 *
 * Está escrito para la operación real de la tienda —venta en línea de
 * productos frescos por presentaciones, con precio estimado que se confirma
 * al procesar el pedido, entrega a domicilio y confirmación por WhatsApp— y
 * no como plantilla genérica. Lo que depende de una decisión comercial que el
 * negocio aún no ha tomado (plazos, tarifas, cobertura) NO está escrito: va
 * como marcador `{{seccion.campo}}` y se ve «por completar» hasta que se
 * diligencia en el panel.
 *
 * Las referencias legales son las del comercio electrónico en Colombia:
 * Ley 1480 de 2011 (Estatuto del Consumidor), Ley 527 de 1999 (comercio
 * electrónico), Ley 1581 de 2012 y Decreto 1377 de 2013 —compilado en el
 * Decreto 1074 de 2015— (datos personales) y Ley 1755 de 2015 (peticiones).
 * Conviene que un abogado revise el texto antes de publicarlo.
 *
 * Cualquier política se puede reescribir entera desde el panel; esto es el
 * respaldo, no un límite.
 */

/** La fecha va vacía a propósito: la pone el negocio al publicar, no el código. */
const SIN_FECHA = { actualizado: "", historial: [] };

export const POLITICAS: Politica[] = [
  /* ================================================================ */
  {
    slug: "terminos-y-condiciones",
    titulo: "Términos y Condiciones de Uso y Compra",
    tituloCorto: "Términos y condiciones",
    grupo: "compra",
    resumen:
      "Las reglas para usar la tienda y comprar en ella: cómo se arma y confirma un pedido, cómo se fija el precio final, cómo se paga, se entrega y qué hacer si algo no sale bien.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "identificacion",
        titulo: "Identificación del comercio",
        bloques: [
          {
            tipo: "p",
            texto:
              "Esta tienda en línea es operada por {{empresa.razon_social}}, con NIT {{empresa.nit}}, bajo el nombre comercial {{nombre}}.",
          },
          { tipo: "componente", nombre: "identificacion" },
        ],
      },
      {
        id: "objeto",
        titulo: "Objeto de la plataforma y aceptación",
        bloques: [
          {
            tipo: "p",
            texto:
              "{{contacto.sitio_web}} es el canal en línea de {{nombre}} para consultar su catálogo, armar pedidos y solicitar su entrega. Estos términos regulan la navegación por la tienda y cada compra que se haga a través de ella.",
          },
          {
            tipo: "p",
            texto:
              "Al enviar un pedido declaras que leíste y aceptas estos términos, la [Política de Tratamiento de Datos Personales](/politica-tratamiento-datos) y las políticas de envíos, cambios y devoluciones. Si no estás de acuerdo con alguna, te pedimos no enviar el pedido y escribirnos por los canales oficiales.",
          },
          {
            tipo: "aviso",
            tono: "info",
            texto:
              "Si compras como consumidor final, te protege el Estatuto del Consumidor (Ley 1480 de 2011) y nada de lo aquí escrito limita esos derechos. Si compras para tu negocio y el producto está ligado a tu actividad económica, algunas de esas reglas pueden no aplicar; las condiciones comerciales de estos términos aplican en ambos casos.",
          },
        ],
      },
      {
        id: "cuenta",
        titulo: "Identificación del cliente y uso de la cuenta",
        bloques: [
          {
            tipo: "p",
            texto:
              "Para hacer un pedido no necesitas crear una contraseña. Según cómo esté configurada la tienda, te identificas con tu nombre y tus datos de contacto en cada pedido, o con tu número de cédula: la primera vez nos das tu nombre, teléfono y dirección, y en los pedidos siguientes basta con la cédula para que reconozcamos tus datos y puedas consultar o repetir pedidos anteriores.",
          },
          {
            tipo: "lista",
            items: [
              "Los datos que entregues deben ser verdaderos, completos y tuyos o de tu negocio. Eres responsable de mantenerlos actualizados.",
              "No uses la cédula de otra persona. Si alguien hizo un pedido con la tuya, escríbenos de inmediato.",
              "Si usas un equipo compartido, usa la opción «¿No eres tú?» para que el navegador olvide tu identificación.",
              "Si en el futuro la tienda habilita cuentas con usuario y contraseña, serás responsable de la confidencialidad de tu clave y de lo que se haga con ella.",
            ],
          },
        ],
      },
      {
        id: "proceso-de-compra",
        titulo: "Proceso de compra",
        bloques: [
          {
            tipo: "lista",
            ordenada: true,
            items: [
              "Eliges los productos, su presentación (por ejemplo, unidad, kilo, caja o bulto) y la cantidad. Algunos productos admiten cantidades fraccionadas.",
              "Si necesitas algo que no está en el catálogo, puedes agregarlo como producto personalizado: su precio y disponibilidad se confirman después.",
              "Revisas tu carrito y diligencias tus datos de entrega.",
              "Aceptas expresamente que los precios mostrados son estimados (ver «Precios»).",
              "Envías el pedido. Recibes un número de pedido y queda registrado en estado «Pendiente».",
              "{{nombre}} revisa el pedido, confirma contigo disponibilidad y valor final —normalmente por WhatsApp o teléfono— y lo prepara para la entrega.",
            ],
          },
          {
            tipo: "p",
            texto:
              "El envío del pedido es una solicitud de compra. El contrato se perfecciona cuando {{nombre}} confirma el pedido con su valor final, conforme a la Ley 527 de 1999 sobre mensajes de datos y comercio electrónico.",
          },
        ],
      },
      {
        id: "productos",
        titulo: "Productos y presentaciones",
        bloques: [
          {
            tipo: "p",
            texto:
              "Cada producto se ofrece en una o varias presentaciones con su propio precio. Las fotografías son de referencia: al tratarse en buena parte de productos del campo, el tamaño, el color, la forma y el peso por unidad pueden variar naturalmente entre una cosecha y otra sin que eso afecte su calidad.",
          },
          {
            tipo: "p",
            texto:
              "En los productos que se venden por peso, la cantidad entregada puede diferir ligeramente de la solicitada por la naturaleza del producto; el valor final se calcula sobre lo efectivamente entregado y te lo informamos al confirmar el pedido.",
          },
        ],
      },
      {
        id: "precios",
        titulo: "Precios",
        bloques: [
          {
            tipo: "aviso",
            tono: "importante",
            titulo: "Los precios de la tienda son estimados",
            texto:
              "El precio de los productos frescos cambia con el mercado. Los valores que ves al armar tu pedido son una referencia y el precio final se ajusta a la cotización del día en que se procesa el pedido. Antes de enviarlo, te pedimos aceptar expresamente esta condición, y el valor final te lo informamos antes de la entrega.",
          },
          {
            tipo: "p",
            texto: "Si no estás de acuerdo con el valor final informado: {{pedidos.ajuste_precio}}",
          },
          {
            tipo: "p",
            texto:
              "Los precios se expresan en pesos colombianos (COP). Un error evidente en un precio publicado —por ejemplo, un valor claramente desproporcionado por una falla de digitación— no obliga a {{nombre}} a vender a ese precio; en ese caso te lo informaremos antes de confirmar y podrás decidir si mantienes el pedido.",
          },
        ],
      },
      {
        id: "impuestos",
        titulo: "Impuestos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Los precios incluyen los impuestos que correspondan según la naturaleza de cada producto. Muchos alimentos frescos están excluidos o exentos de IVA, y otros productos sí lo causan; el detalle de cada impuesto aparece en la factura.",
          },
        ],
      },
      {
        id: "disponibilidad",
        titulo: "Disponibilidad de productos",
        bloques: [
          {
            tipo: "p",
            texto:
              "La oferta depende de la cosecha, la temporada y el inventario del día. Que un producto aparezca en el catálogo no garantiza su disponibilidad al momento de procesar el pedido.",
          },
          {
            tipo: "p",
            texto:
              "Si un producto no está disponible, te avisaremos antes de la entrega para que decidas si lo reemplazamos por uno equivalente, lo retiramos del pedido o cancelas el pedido completo. Si ya habías pagado lo que no podemos entregar, te devolvemos ese valor.",
          },
        ],
      },
      {
        id: "medios-de-pago",
        titulo: "Métodos de pago",
        bloques: [
          {
            tipo: "p",
            texto:
              "Los medios de pago disponibles, cuándo se paga y cómo se confirma un pago están descritos en la [política de Medios de Pago](/medios-de-pago). {{nombre}} nunca te pedirá claves, códigos de verificación ni datos completos de tu tarjeta por WhatsApp, teléfono o correo.",
          },
        ],
      },
      {
        id: "confirmacion",
        titulo: "Confirmación, estados y cancelación del pedido",
        bloques: [
          {
            tipo: "p",
            texto: "Puedes seguir tu pedido por sus estados:",
          },
          { tipo: "componente", nombre: "estados-pedido" },
          { tipo: "p", texto: "Cancelación de pedidos: {{pedidos.cancelacion}}" },
        ],
      },
      {
        id: "facturacion",
        titulo: "Facturación",
        bloques: [
          {
            tipo: "p",
            texto:
              "Por cada compra se expide la factura que corresponda conforme a la normativa de la DIAN, a nombre de la persona o empresa que figure en el pedido. Si necesitas la factura a nombre de tu negocio, indícanos la razón social y el NIT al hacer el pedido o antes de que se despache; después de expedida, una factura solo puede corregirse por los mecanismos que permite la norma.",
          },
        ],
      },
      {
        id: "entrega",
        titulo: "Entrega y domicilios",
        bloques: [
          {
            tipo: "p",
            texto:
              "Las zonas de cobertura, horarios, tiempos estimados, costos de envío y lo que necesitas para recibir están en la [Política de Envíos y Entregas](/politica-de-envios). Al recibir, revisa el pedido frente a lo confirmado: los productos frescos deben revisarse en el momento de la entrega.",
          },
        ],
      },
      {
        id: "cambios-y-devoluciones",
        titulo: "Cambios, devoluciones y retracto",
        bloques: [
          {
            tipo: "p",
            texto:
              "Si un producto llega defectuoso, en mal estado o no corresponde a lo que pediste, tienes derecho a que lo solucionemos. Cómo y en qué plazos se explica en la [política de Cambios y Devoluciones](/cambios-y-devoluciones).",
          },
          {
            tipo: "p",
            texto:
              "El derecho de retracto de las compras a distancia (artículo 47 de la Ley 1480 de 2011) tiene excepciones legales que alcanzan a buena parte de nuestro catálogo, como los productos perecederos. Su alcance se explica en la [Política de Retracto](/politica-de-retracto).",
          },
        ],
      },
      {
        id: "garantias",
        titulo: "Garantías",
        bloques: [
          {
            tipo: "p",
            texto:
              "{{nombre}} responde por la calidad, idoneidad y seguridad de los productos que vende, conforme a la garantía legal del Estatuto del Consumidor. En los alimentos y productos perecederos, la garantía cubre que el producto llegue en condiciones aptas para su consumo y dentro de su vida útil; por su naturaleza, cualquier problema debe reportarse dentro de {{devoluciones.plazo_reporte}}.",
          },
          {
            tipo: "p",
            texto:
              "La garantía no cubre el deterioro causado por un almacenamiento o manipulación inadecuados después de la entrega, ni las variaciones naturales de tamaño, forma o color descritas en «Productos y presentaciones».",
          },
        ],
      },
      {
        id: "responsabilidades",
        titulo: "Responsabilidades del usuario",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Dar información verdadera, en especial la dirección de entrega y un teléfono donde podamos contactarte.",
              "Estar disponible, o dejar a alguien autorizado, para recibir el pedido en la dirección y franja acordadas.",
              "Revisar el pedido al recibirlo y reportar de inmediato cualquier novedad.",
              "Conservar y almacenar los productos perecederos en las condiciones adecuadas desde la entrega.",
              "Pagar el valor final confirmado por los medios acordados.",
            ],
          },
        ],
      },
      {
        id: "limitacion",
        titulo: "Limitaciones de responsabilidad",
        bloques: [
          {
            tipo: "p",
            texto:
              "{{nombre}} procura que la tienda funcione sin interrupciones y que la información publicada sea exacta, pero no garantiza que esté siempre disponible ni libre de errores, y puede suspenderla para mantenimiento. No responde por daños derivados del mal uso de la tienda, de fallas de tu conexión o equipo, de la información falsa que se le entregue ni de hechos de fuerza mayor o caso fortuito que impidan o retrasen una entrega.",
          },
          {
            tipo: "p",
            texto:
              "Estas limitaciones aplican en la medida en que la ley lo permita y nunca restringen los derechos irrenunciables del consumidor ni las obligaciones de calidad, idoneidad, seguridad y garantía que la ley impone al vendedor.",
          },
        ],
      },
      {
        id: "propiedad-intelectual",
        titulo: "Propiedad intelectual",
        bloques: [
          {
            tipo: "p",
            texto:
              "La marca {{nombre}}, su logotipo, las fotografías, los textos y el diseño de la tienda pertenecen a {{empresa.razon_social}} o a quienes le autorizaron su uso. No pueden copiarse, reproducirse ni usarse con fines comerciales sin autorización previa y escrita.",
          },
        ],
      },
      {
        id: "uso-indebido",
        titulo: "Uso indebido del sitio",
        bloques: [
          {
            tipo: "p",
            texto: "Está prohibido:",
          },
          {
            tipo: "lista",
            items: [
              "Hacer pedidos falsos, a nombre de terceros sin su autorización o con el fin de perjudicar a la tienda o a otras personas.",
              "Consultar cédulas ajenas o intentar acceder a información de otros clientes.",
              "Extraer el catálogo o los precios de forma automatizada, sobrecargar el sitio o intentar vulnerar su seguridad.",
              "Usar la tienda para cualquier fin contrario a la ley.",
            ],
          },
          {
            tipo: "p",
            texto:
              "{{nombre}} puede rechazar o cancelar los pedidos relacionados con estas conductas y limitar el acceso a quien las realice, sin perjuicio de las acciones legales que correspondan.",
          },
        ],
      },
      {
        id: "modificaciones",
        titulo: "Modificaciones de los términos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Estos términos pueden actualizarse para reflejar cambios en la operación o en la ley. La versión vigente es siempre la publicada en esta página, con su fecha de actualización, y cada pedido se rige por la versión vigente el día en que se envió. Los cambios relevantes se anuncian en la tienda.",
          },
        ],
      },
      {
        id: "ley-aplicable",
        titulo: "Legislación aplicable",
        bloques: [
          {
            tipo: "p",
            texto:
              "Estos términos se rigen por las leyes de la República de Colombia, en particular la Ley 1480 de 2011 (Estatuto del Consumidor), la Ley 527 de 1999 (comercio electrónico) y la Ley 1581 de 2012 (protección de datos personales). Cualquier diferencia se intentará resolver primero de forma directa por los canales oficiales; si no hay acuerdo, el consumidor puede acudir a la Superintendencia de Industria y Comercio o a los jueces de la República.",
          },
        ],
      },
      {
        id: "contacto",
        titulo: "Canales oficiales de contacto",
        bloques: [{ tipo: "componente", nombre: "canales" }],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "politica-de-privacidad",
    titulo: "Política de Privacidad",
    tituloCorto: "Política de privacidad",
    grupo: "datos",
    resumen:
      "En pocas palabras: qué datos tuyos usamos, para qué, con quién los compartimos y cómo puedes controlarlos. El detalle legal completo está en la [Política de Tratamiento de Datos Personales](/politica-tratamiento-datos).",
    ...SIN_FECHA,
    secciones: [
      {
        id: "quien",
        titulo: "Quién cuida tus datos",
        bloques: [
          {
            tipo: "p",
            texto:
              "{{empresa.razon_social}} (NIT {{empresa.nit}}), que opera la tienda {{nombre}}, es responsable de los datos personales que entregas al comprar o al escribirnos.",
          },
        ],
      },
      {
        id: "que-datos",
        titulo: "Qué datos usamos",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Para entregarte un pedido: nombre o razón social, teléfono, dirección de entrega y, si la tienda te identifica así, tu número de cédula.",
              "Para facturar: los datos que exija la factura, como NIT o cédula y razón social.",
              "Lo que nos cuentes al escribirnos por el formulario de contacto, WhatsApp, teléfono o correo.",
              "Datos técnicos mínimos para que la tienda funcione, como tu carrito guardado en el navegador.",
            ],
          },
          {
            tipo: "p",
            texto:
              "No te pedimos datos sensibles (salud, origen étnico, creencias, datos biométricos) ni los necesitamos para venderte.",
          },
        ],
      },
      {
        id: "para-que",
        titulo: "Para qué los usamos",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Recibir, confirmar, preparar y entregar tus pedidos, e informarte el valor final.",
              "Expedir la factura y cumplir nuestras obligaciones contables y tributarias.",
              "Atender tus preguntas, peticiones, quejas, reclamos y garantías.",
              "Reconocerte cuando vuelves, para que puedas consultar y repetir pedidos.",
              "Enviarte ofertas y novedades solo si nos autorizas, y dejar de hacerlo cuando nos lo pidas.",
            ],
          },
        ],
      },
      {
        id: "con-quien",
        titulo: "Con quién los compartimos",
        bloques: [
          {
            tipo: "p",
            texto:
              "No vendemos ni alquilamos tus datos. Solo los conocen quienes nos ayudan a prestarte el servicio y en la medida necesaria: quien entrega tu pedido, el proveedor de la plataforma tecnológica de la tienda, el proveedor de facturación electrónica y, si pagas en línea, la entidad que procesa el pago. También los entregamos a una autoridad cuando la ley lo exige.",
          },
        ],
      },
      {
        id: "cuanto-tiempo",
        titulo: "Cuánto tiempo los conservamos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Mientras seas cliente y durante los plazos que exigen las normas comerciales, contables y tributarias para los soportes de las ventas. Los datos que solo sirven para comunicaciones comerciales se eliminan cuando revocas tu autorización.",
          },
        ],
      },
      {
        id: "tus-derechos",
        titulo: "Tus derechos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Puedes conocer, actualizar y corregir tus datos, pedir que los eliminemos cuando no haya un deber legal de conservarlos y revocar la autorización que nos diste. Escríbenos a {{contacto.correo_datos_personales}}. El procedimiento y los plazos están en la [Política de Tratamiento de Datos Personales](/politica-tratamiento-datos).",
          },
        ],
      },
      {
        id: "navegador",
        titulo: "Cookies y datos en tu navegador",
        bloques: [
          {
            tipo: "p",
            texto:
              "La tienda guarda en tu navegador lo necesario para funcionar, como el carrito. No usa hoy cookies analíticas ni publicitarias. El detalle está en la [Política de Cookies](/politica-de-cookies).",
          },
        ],
      },
      {
        id: "menores",
        titulo: "Menores de edad",
        bloques: [
          {
            tipo: "p",
            texto:
              "La tienda está dirigida a personas mayores de edad. No recopilamos a sabiendas datos de niños, niñas o adolescentes; si un menor nos entregó sus datos, su representante puede pedirnos eliminarlos.",
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "politica-tratamiento-datos",
    titulo: "Política de Tratamiento de Datos Personales",
    tituloCorto: "Tratamiento de datos",
    grupo: "datos",
    resumen:
      "Cómo {{nombre}} recolecta, usa, guarda y protege los datos personales de sus clientes, y cómo puedes ejercer tus derechos, conforme a la Ley 1581 de 2012 y sus decretos reglamentarios.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "responsable",
        titulo: "Responsable del tratamiento",
        bloques: [{ tipo: "componente", nombre: "identificacion" }],
      },
      {
        id: "marco-legal",
        titulo: "Marco legal y alcance",
        bloques: [
          {
            tipo: "p",
            texto:
              "Esta política desarrolla el derecho de habeas data (artículo 15 de la Constitución) y cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015. Aplica a los datos personales que {{nombre}} trata en su tienda en línea, en los pedidos que recibe por otros canales y en su servicio al cliente.",
          },
        ],
      },
      {
        id: "datos-recopilados",
        titulo: "Datos que podemos recopilar",
        bloques: [
          {
            tipo: "datos",
            filas: [
              {
                etiqueta: "Al hacer un pedido",
                valor: "Nombre o razón social, teléfono, dirección de entrega y observaciones del pedido.",
              },
              {
                etiqueta: "Si la tienda te identifica por cédula",
                valor:
                  "Número de cédula, y la fecha en que aceptaste las condiciones de precio en tu primer pedido. Con ella consultamos tus pedidos anteriores para que puedas repetirlos.",
              },
              {
                etiqueta: "Para facturar",
                valor: "Número de identificación (cédula o NIT), razón social y los demás datos que exija la factura electrónica.",
              },
              {
                etiqueta: "Al escribirnos",
                valor:
                  "Lo que nos envíes por el formulario de contacto, WhatsApp, teléfono o correo: nombre, datos de contacto y el contenido de tu mensaje.",
              },
              {
                etiqueta: "Al navegar",
                valor:
                  "El contenido de tu carrito y tus preferencias guardadas en tu propio navegador, y los datos técnicos que cualquier servidor web recibe, como la dirección IP.",
              },
              {
                etiqueta: "Historial de compras",
                valor: "Los productos, cantidades, valores, fechas y estado de tus pedidos.",
              },
            ],
          },
          {
            tipo: "p",
            texto:
              "No solicitamos datos sensibles. Si alguna vez fuera necesario, te lo pediremos de forma expresa, te explicaremos para qué y no estarás obligado a entregarlos.",
          },
        ],
      },
      {
        id: "finalidades",
        titulo: "Finalidades del tratamiento",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Gestionar tus pedidos: recibirlos, confirmar disponibilidad y valor final, prepararlos, coordinar la entrega y registrar su estado.",
              "Facturación: expedir facturas y notas, y cumplir las obligaciones contables, tributarias y comerciales.",
              "Contacto y servicio al cliente: atender consultas, peticiones, quejas, reclamos, garantías, cambios y devoluciones.",
              "Reconocerte en compras posteriores y permitirte consultar y repetir tus pedidos.",
              "Comunicaciones comerciales: enviarte ofertas, novedades y precios del día, únicamente cuando lo hayas autorizado de forma expresa. Puedes retirar esa autorización en cualquier momento sin que afecte tus compras.",
              "Prevenir fraudes y usos indebidos de la tienda, y proteger su seguridad.",
              "Atender requerimientos de autoridades competentes y cumplir la ley.",
            ],
          },
        ],
      },
      {
        id: "autorizacion",
        titulo: "Autorización",
        bloques: [
          {
            tipo: "p",
            texto:
              "Tratamos tus datos con tu autorización previa, expresa e informada, que otorgas al enviar un pedido o un mensaje tras haber sido informado de esta política, o por cualquier otro medio que permita demostrarla. No requieren autorización los datos de naturaleza pública ni los casos que la ley exceptúa. Conservamos prueba de la autorización.",
          },
        ],
      },
      {
        id: "cookies",
        titulo: "Cookies y tecnologías similares",
        bloques: [
          {
            tipo: "p",
            texto:
              "La tienda usa almacenamiento en tu navegador para funciones como el carrito y para recordarte si así lo eliges. El inventario completo y cómo gestionarlo está en la [Política de Cookies](/politica-de-cookies).",
          },
        ],
      },
      {
        id: "terceros",
        titulo: "Encargados y terceros que intervienen",
        bloques: [
          {
            tipo: "p",
            texto:
              "Para prestar el servicio, algunos terceros tratan datos por cuenta de {{nombre}}, solo para las finalidades aquí descritas y con obligaciones de confidencialidad y seguridad:",
          },
          {
            tipo: "lista",
            items: [
              "El proveedor de la plataforma tecnológica que aloja la tienda y sus pedidos.",
              "Las personas o empresas que realizan las entregas, que reciben tu nombre, teléfono y dirección.",
              "El proveedor de facturación electrónica autorizado por la DIAN.",
              "La pasarela o entidad financiera que procese los pagos en línea, si se usa.",
              "Servicios de mensajería como WhatsApp, cuando eliges comunicarte por ellos.",
            ],
          },
          {
            tipo: "p",
            texto:
              "Algunos de estos proveedores pueden almacenar información en servidores ubicados fuera de Colombia. En ese caso la transferencia o transmisión se hace conforme a la Ley 1581 de 2012, a países con niveles adecuados de protección o con las garantías contractuales que la ley exige.",
          },
        ],
      },
      {
        id: "seguridad",
        titulo: "Seguridad de la información",
        bloques: [
          {
            tipo: "p",
            texto:
              "Aplicamos medidas técnicas, humanas y administrativas para proteger tus datos contra acceso no autorizado, pérdida o alteración: conexión cifrada (HTTPS), acceso restringido a la información de clientes según el cargo, separación de la información de cada negocio en la plataforma y datos enmascarados cuando se muestran en pantalla (por ejemplo, el teléfono o la dirección parcial al reconocer una cédula).",
          },
        ],
      },
      {
        id: "conservacion",
        titulo: "Conservación de los datos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Conservamos los datos mientras exista una relación comercial contigo y durante los plazos que exigen las normas comerciales, contables y tributarias para los soportes de las ventas. Cumplidos esos plazos, se eliminan o anonimizan.",
          },
        ],
      },
      {
        id: "derechos",
        titulo: "Derechos del titular",
        bloques: [{ tipo: "componente", nombre: "derechos-titular" }],
      },
      {
        id: "consultas-y-reclamos",
        titulo: "Procedimiento para consultas y reclamos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Puedes ejercer tus derechos tú mismo, tus causahabientes o un representante acreditado, escribiendo a {{contacto.correo_datos_personales}} o por los demás canales oficiales. Indica tu nombre, tu número de identificación, lo que solicitas y un dato de contacto para responderte.",
          },
          {
            tipo: "datos",
            filas: [
              {
                etiqueta: "Consultas",
                valor:
                  "Para conocer qué datos tuyos tenemos y cómo los usamos. Respondemos en máximo 10 días hábiles; si no es posible, te informamos el motivo y respondemos dentro de los 5 días hábiles siguientes.",
              },
              {
                etiqueta: "Reclamos",
                valor:
                  "Para corregir, actualizar o suprimir datos, revocar la autorización o reportar un incumplimiento. Respondemos en máximo 15 días hábiles, prorrogables hasta por 8 días hábiles más informándote el motivo. Si el reclamo está incompleto, te pedimos completarlo dentro de los 5 días siguientes; pasados 2 meses sin respuesta, se entiende desistido.",
              },
            ],
          },
          {
            tipo: "p",
            texto:
              "Mientras se resuelve un reclamo, el dato se marca como «reclamo en trámite». Antes de acudir a la Superintendencia de Industria y Comercio, la ley pide agotar este trámite con nosotros.",
          },
        ],
      },
      {
        id: "revocatoria",
        titulo: "Revocatoria de la autorización y supresión",
        bloques: [
          {
            tipo: "p",
            texto:
              "Puedes revocar tu autorización o pedir que eliminemos tus datos en cualquier momento. No procederá mientras exista un deber legal o contractual de conservarlos —por ejemplo, los datos de una factura expedida o de un pedido con una garantía en curso—; en ese caso te lo explicaremos y los usaremos solo para esa finalidad. La revocatoria de las comunicaciones comerciales no afecta tus compras.",
          },
        ],
      },
      {
        id: "canal",
        titulo: "Canal de contacto",
        bloques: [
          {
            tipo: "datos",
            filas: [
              { etiqueta: "Correo para datos personales", valor: "{{contacto.correo_datos_personales}}" },
              { etiqueta: "Dirección de notificaciones", valor: "{{contacto.direccion_notificaciones}}" },
              { etiqueta: "Teléfono", valor: "{{contacto.telefono}}" },
              { etiqueta: "Horario de atención", valor: "{{contacto.horario_atencion}}" },
            ],
          },
        ],
      },
      {
        id: "vigencia",
        titulo: "Vigencia y actualizaciones",
        bloques: [
          {
            tipo: "p",
            texto:
              "Esta política rige desde su fecha de publicación. Si cambia de forma sustancial —en especial en las finalidades del tratamiento o en la identidad del responsable— te lo informaremos por la tienda antes de aplicar los cambios, y cuando corresponda pediremos una nueva autorización. Las versiones anteriores quedan registradas al final de esta página.",
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "politica-de-cookies",
    titulo: "Política de Cookies",
    tituloCorto: "Política de cookies",
    grupo: "datos",
    resumen:
      "Qué guarda la tienda en tu navegador, para qué sirve cada cosa y cómo puedes borrarla. Hoy solo usamos lo necesario para que la tienda funcione y para recordarte.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "que-son",
        titulo: "Qué son las cookies",
        bloques: [
          {
            tipo: "p",
            texto:
              "Las cookies son pequeños archivos que un sitio guarda en tu navegador para recordar información entre una página y otra. El almacenamiento local cumple una función parecida. En esta política llamamos «cookies» a ambas.",
          },
        ],
      },
      {
        id: "tipos",
        titulo: "Tipos de cookies y cuáles usamos",
        bloques: [{ tipo: "componente", nombre: "cookies" }],
      },
      {
        id: "finalidad",
        titulo: "Finalidad",
        bloques: [
          {
            tipo: "p",
            texto:
              "Las usamos para que el carrito no se pierda mientras compras, para que la tienda te reconozca si te identificas por cédula y para que puedas repetir tu último pedido. No las usamos para seguirte en otros sitios ni para mostrarte publicidad.",
          },
          {
            tipo: "aviso",
            tono: "info",
            texto:
              "Si en el futuro la tienda incorpora cookies analíticas o publicitarias, no se activarán sin que antes aceptes su uso desde el aviso de cookies, y podrás cambiar tu decisión cuando quieras.",
          },
        ],
      },
      {
        id: "gestion",
        titulo: "Cómo gestionar o desactivar las cookies",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Desde la tienda: «¿No eres tú?» borra tu identificación guardada, y vaciar el carrito borra su contenido.",
              "Desde tu navegador: puedes borrar las cookies y los datos de sitios, o bloquearlos, en la configuración de privacidad de Chrome, Safari, Firefox o Edge.",
              "Si bloqueas las necesarias, la tienda no podrá guardar tu carrito y no podrás completar un pedido.",
            ],
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "politica-de-envios",
    titulo: "Política de Envíos y Entregas",
    tituloCorto: "Envíos y entregas",
    grupo: "compra",
    resumen:
      "Dónde entregamos, en qué horarios, cuánto tarda y cuesta, y qué necesitas para recibir tu pedido en buenas condiciones.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "cobertura",
        titulo: "Zonas de cobertura",
        bloques: [
          { tipo: "componente", nombre: "cobertura" },
          {
            tipo: "p",
            texto:
              "Si tu dirección está fuera de estas zonas, escríbenos antes de hacer el pedido para revisar si podemos atenderte.",
          },
        ],
      },
      {
        id: "horarios-y-tiempos",
        titulo: "Horarios y tiempos estimados",
        bloques: [
          {
            tipo: "datos",
            filas: [
              { etiqueta: "Horarios de entrega", valor: "{{envios.horarios}}" },
              { etiqueta: "Tiempo estimado", valor: "{{envios.tiempos}}" },
            ],
          },
          {
            tipo: "p",
            texto:
              "Los tiempos son estimados y se cuentan desde que confirmamos tu pedido. Al confirmarlo te indicaremos la franja de entrega.",
          },
        ],
      },
      {
        id: "costos",
        titulo: "Costos de envío",
        bloques: [
          {
            tipo: "datos",
            filas: [
              { etiqueta: "Costo del domicilio", valor: "{{envios.costos}}" },
              { etiqueta: "Pedido mínimo", valor: "{{envios.pedido_minimo}}" },
            ],
          },
          {
            tipo: "p",
            texto: "El valor del envío se informa antes de confirmar el pedido y aparece por separado en la factura.",
          },
        ],
      },
      {
        id: "condiciones",
        titulo: "Condiciones especiales",
        bloques: [{ tipo: "p", texto: "{{envios.condiciones}}" }],
      },
      {
        id: "perecederos",
        titulo: "Productos perecederos y sensibles",
        bloques: [
          {
            tipo: "p",
            texto:
              "Buena parte de lo que vendemos es fresco y perecedero. Lo preparamos lo más cerca posible a la entrega y lo transportamos protegiéndolo del sol y de golpes.",
          },
          { tipo: "p", texto: "{{envios.perecederos}}" },
          {
            tipo: "aviso",
            tono: "importante",
            texto:
              "Al recibir, guarda en refrigeración lo que lo requiera. Desde la entrega, la conservación de los productos queda a cargo de quien los recibe.",
          },
        ],
      },
      {
        id: "recibir",
        titulo: "Información necesaria para recibir el pedido",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Dirección completa con referencias (barrio, torre, apartamento, local o punto de referencia).",
              "Un teléfono activo donde podamos avisarte de la llegada.",
              "Una persona mayor de edad que reciba, revise y firme o confirme la entrega.",
            ],
          },
          { tipo: "p", texto: "{{envios.requisitos}}" },
        ],
      },
      {
        id: "confirmacion",
        titulo: "Confirmación de entrega",
        bloques: [
          {
            tipo: "p",
            texto:
              "Revisa el pedido al recibirlo, frente a lo confirmado. Si falta algo, sobra algo o un producto no llegó en buen estado, dilo en ese momento a quien entrega y repórtalo por nuestros canales; así podemos solucionarlo rápido. Con la entrega, el pedido pasa a estado «Entregado».",
          },
          { tipo: "p", texto: "{{envios.confirmacion}}" },
        ],
      },
      {
        id: "retrasos",
        titulo: "Qué ocurre ante retrasos",
        bloques: [
          {
            tipo: "p",
            texto:
              "Si prevemos un retraso te avisaremos tan pronto lo sepamos, con una nueva franja de entrega.",
          },
          { tipo: "p", texto: "{{envios.retrasos}}" },
          {
            tipo: "p",
            texto:
              "Si no podemos entregar en el plazo acordado —o, a falta de acuerdo, dentro de los 30 días calendario siguientes al pedido, como prevé el Estatuto del Consumidor— puedes cancelarlo y te devolvemos lo que hayas pagado.",
          },
        ],
      },
      {
        id: "no-recibido",
        titulo: "Si no hay quién reciba",
        bloques: [
          {
            tipo: "p",
            texto:
              "Si en la dirección no hay quién reciba o no logramos comunicarnos contigo, coordinaremos una nueva entrega. Por tratarse de productos perecederos, un segundo intento puede tener costo adicional, que te informaremos antes.",
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "cambios-y-devoluciones",
    titulo: "Cambios, Devoluciones y Garantías",
    tituloCorto: "Cambios y devoluciones",
    grupo: "compra",
    resumen:
      "Qué hacer si un producto llegó en mal estado, no es el que pediste o quieres cambiarlo, y en qué se diferencia cada caso.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "casos",
        titulo: "Cada caso es distinto",
        bloques: [
          {
            tipo: "p",
            texto:
              "No es lo mismo un producto que llegó dañado que uno que ya no quieres. Así tratamos cada situación:",
          },
          { tipo: "componente", nombre: "casos-devolucion" },
        ],
      },
      {
        id: "perecederos",
        titulo: "Productos con excepciones por su naturaleza",
        bloques: [
          {
            tipo: "p",
            texto:
              "Los alimentos frescos y perecederos no admiten cambio ni devolución por simple preferencia una vez entregados, porque no pueden volver a venderse con seguridad. Esto no afecta tu derecho a la garantía: si llegaron en mal estado o no corresponden a lo pedido, siempre lo solucionamos.",
          },
          { tipo: "p", texto: "Otros productos sin cambio por su naturaleza: {{devoluciones.excepciones}}" },
          {
            tipo: "p",
            texto:
              "Los productos pedidos fuera de catálogo o preparados según tus indicaciones solo admiten reclamación por defecto o por no corresponder a lo acordado.",
          },
        ],
      },
      {
        id: "procedimiento",
        titulo: "Cómo solicitarlo",
        bloques: [
          {
            tipo: "lista",
            ordenada: true,
            items: [
              "Escríbenos por WhatsApp o correo dentro del plazo que corresponda: para productos defectuosos o incorrectos, {{devoluciones.plazo_reporte}}; para cambios, {{devoluciones.plazo_cambios}}.",
              "Indica tu número de pedido, el producto y qué ocurrió.",
              "Adjunta fotos del producto y del empaque. En productos frescos, las fotos al momento de la entrega son la mejor prueba.",
              "Conserva el producto mientras revisamos tu caso, salvo que te indiquemos otra cosa.",
              "Te damos un número de solicitud y la solución: reposición, cambio, nota crédito o reembolso, según el caso.",
            ],
          },
        ],
      },
      {
        id: "condiciones",
        titulo: "Condiciones del producto",
        bloques: [{ tipo: "p", texto: "{{devoluciones.condiciones}}" }],
      },
      {
        id: "reembolsos",
        titulo: "Reembolsos y costos",
        bloques: [
          {
            tipo: "datos",
            filas: [
              { etiqueta: "Forma de reembolso", valor: "{{devoluciones.reembolso}}" },
              { etiqueta: "Transporte de una devolución", valor: "{{devoluciones.costos_devolucion}}" },
            ],
          },
          {
            tipo: "p",
            texto:
              "Cuando el problema es nuestro —producto defectuoso, en mal estado o distinto al pedido— la solución no te cuesta nada, incluido el transporte.",
          },
        ],
      },
      {
        id: "tiempos",
        titulo: "Tiempos de respuesta",
        bloques: [
          {
            tipo: "p",
            texto:
              "Respondemos tu solicitud en {{devoluciones.tiempo_respuesta}}. Las solicitudes de garantía se resuelven en máximo 15 días hábiles, como establece la ley.",
          },
        ],
      },
      {
        id: "canales",
        titulo: "Canales de atención",
        bloques: [{ tipo: "componente", nombre: "canales" }],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "politica-de-retracto",
    titulo: "Política de Derecho de Retracto",
    tituloCorto: "Derecho de retracto",
    grupo: "compra",
    resumen:
      "Cuándo puedes desistir de una compra hecha en línea sin dar explicaciones, qué productos están excluidos por ley y cómo pedir la reversión de un pago.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "que-es",
        titulo: "Qué es el derecho de retracto",
        bloques: [
          {
            tipo: "p",
            texto:
              "En las compras a distancia, como las de esta tienda, el artículo 47 de la Ley 1480 de 2011 permite al consumidor desistir de la compra dentro de los 5 días hábiles siguientes a la entrega del producto, sin tener que justificarlo.",
          },
        ],
      },
      {
        id: "excepciones",
        titulo: "Productos excluidos por la ley",
        bloques: [
          {
            tipo: "p",
            texto: "La misma ley excluye del retracto, entre otros:",
          },
          {
            tipo: "lista",
            items: [
              "Los bienes perecederos, como frutas, verduras, carnes, lácteos y demás alimentos frescos.",
              "Los bienes confeccionados conforme a las especificaciones del consumidor o claramente personalizados, como los pedidos fuera de catálogo preparados a tu medida.",
              "Los bienes de uso personal.",
              "Los servicios cuya prestación haya comenzado con tu acuerdo.",
            ],
          },
          {
            tipo: "aviso",
            tono: "info",
            texto:
              "Que un producto esté excluido del retracto no le quita la garantía: si llega en mal estado o no es lo que pediste, lo solucionamos (ver [Cambios y Devoluciones](/cambios-y-devoluciones)).",
          },
        ],
      },
      {
        id: "como-ejercerlo",
        titulo: "Cómo ejercerlo",
        bloques: [
          {
            tipo: "lista",
            ordenada: true,
            items: [
              "Avísanos dentro de los 5 días hábiles siguientes a la entrega, por cualquiera de los canales oficiales, indicando tu número de pedido.",
              "Devuelve el producto por los mismos medios y en las mismas condiciones en que lo recibiste: sin uso y con su empaque.",
              "Los costos de transporte y demás que implique la devolución corren por tu cuenta, como prevé la ley.",
            ],
          },
        ],
      },
      {
        id: "reembolso",
        titulo: "Devolución del dinero",
        bloques: [
          {
            tipo: "p",
            texto:
              "Te devolvemos todas las sumas pagadas, sin descuentos ni retenciones, en un plazo máximo de 30 días calendario desde que ejerciste el retracto. Forma de reembolso: {{devoluciones.reembolso}}",
          },
        ],
      },
      {
        id: "reversion",
        titulo: "Reversión del pago",
        bloques: [
          {
            tipo: "p",
            texto:
              "Si pagaste con tarjeta de crédito, débito o cualquier otro instrumento de pago electrónico, el artículo 51 de la Ley 1480 de 2011 te permite pedir la reversión del pago cuando fuiste objeto de fraude, la operación no fue solicitada, el producto no se recibió, o el producto no corresponde a lo pedido o es defectuoso.",
          },
          {
            tipo: "lista",
            ordenada: true,
            items: [
              "Preséntala dentro de los 5 días hábiles siguientes a la fecha en que conociste la operación o debiste recibir el producto.",
              "Comunícalo a {{nombre}} por los canales oficiales y al emisor del instrumento de pago (tu banco o entidad).",
              "Si corresponde, devuelve el producto en las mismas condiciones en que lo recibiste.",
            ],
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "medios-de-pago",
    titulo: "Medios de Pago",
    tituloCorto: "Medios de pago",
    grupo: "compra",
    resumen: "Cómo puedes pagar tu pedido, cuándo se paga, cómo se confirma el pago y cómo cuidamos tus transacciones.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "disponibles",
        titulo: "Medios de pago disponibles",
        bloques: [{ tipo: "componente", nombre: "metodos-pago" }],
      },
      {
        id: "cuando",
        titulo: "Cuándo se paga y cómo se confirma",
        bloques: [
          {
            tipo: "p",
            texto:
              "Como el precio final de los productos frescos se confirma al procesar el pedido, el valor a pagar es el que te informamos en esa confirmación, más el envío si aplica.",
          },
          { tipo: "p", texto: "{{pagos.confirmacion}}" },
        ],
      },
      {
        id: "estados",
        titulo: "Estados del pedido",
        bloques: [{ tipo: "componente", nombre: "estados-pedido" }],
      },
      {
        id: "seguridad",
        titulo: "Seguridad de las transacciones",
        bloques: [
          {
            tipo: "p",
            texto:
              "La tienda funciona sobre una conexión cifrada (HTTPS) y no almacena números de tarjeta. Los pagos en línea, si están habilitados, se procesan directamente en la plataforma de la entidad de pagos: {{pagos.seguridad}}",
          },
          {
            tipo: "aviso",
            tono: "importante",
            titulo: "Cuida tus datos",
            texto:
              "{{nombre}} nunca te pedirá claves, códigos de verificación ni el número completo de tu tarjeta por WhatsApp, teléfono o correo. Si alguien lo hace en nuestro nombre, no respondas y repórtalo por los canales oficiales.",
          },
        ],
      },
      {
        id: "reversion",
        titulo: "Reversión del pago y facturación",
        bloques: [
          {
            tipo: "p",
            texto:
              "Si pagaste por medios electrónicos, puedes pedir la reversión del pago en los casos previstos por la ley; el procedimiento está en la [Política de Retracto](/politica-de-retracto). Por cada compra se expide la factura correspondiente.",
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  {
    slug: "contacto-y-peticiones",
    titulo: "Peticiones, Quejas, Reclamos y Solicitudes",
    tituloCorto: "PQRS y contacto",
    grupo: "atencion",
    resumen:
      "Cómo presentarnos una petición, queja, reclamo o solicitud —también sobre tus datos personales o un pedido— y en cuánto tiempo te respondemos.",
    ...SIN_FECHA,
    secciones: [
      {
        id: "tipos",
        titulo: "¿Qué quieres presentar?",
        bloques: [{ tipo: "componente", nombre: "tipos-pqrs" }],
      },
      {
        id: "canales",
        titulo: "Canales oficiales de atención",
        bloques: [{ tipo: "componente", nombre: "canales" }],
      },
      {
        id: "que-incluir",
        titulo: "Qué incluir en tu solicitud",
        bloques: [
          {
            tipo: "lista",
            items: [
              "Tu nombre y número de identificación.",
              "Un teléfono o correo donde responderte.",
              "El número de pedido, si tu solicitud está relacionada con uno.",
              "Qué ocurrió y qué solución esperas.",
              "Fotos o documentos que ayuden a entender el caso.",
            ],
          },
        ],
      },
      {
        id: "tiempos",
        titulo: "Tiempos de respuesta",
        bloques: [
          {
            tipo: "datos",
            filas: [
              { etiqueta: "Peticiones, quejas y reclamos", valor: "Hasta 15 días hábiles (Ley 1755 de 2015)." },
              { etiqueta: "Garantías", valor: "Hasta 15 días hábiles (Ley 1480 de 2011)." },
              { etiqueta: "Consultas sobre datos personales", valor: "Hasta 10 días hábiles, prorrogables 5 más (Ley 1581 de 2012)." },
              { etiqueta: "Reclamos sobre datos personales", valor: "Hasta 15 días hábiles, prorrogables 8 más (Ley 1581 de 2012)." },
            ],
          },
          {
            tipo: "p",
            texto:
              "Los plazos se cuentan desde el día hábil siguiente a la recepción. Al recibir tu solicitud te damos un número para hacerle seguimiento.",
          },
        ],
      },
      {
        id: "sic",
        titulo: "Si no quedas satisfecho",
        bloques: [
          {
            tipo: "p",
            texto:
              "Si consideras que no atendimos debidamente tu solicitud, puedes acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co), autoridad de protección al consumidor y de datos personales en Colombia.",
          },
        ],
      },
    ],
  },
];

export function politicaPorSlug(slug: string): Politica | undefined {
  return POLITICAS.find((p) => p.slug === slug);
}

export const GRUPOS: Record<Politica["grupo"], string> = {
  compra: "Compras",
  datos: "Tus datos",
  atencion: "Atención",
};
