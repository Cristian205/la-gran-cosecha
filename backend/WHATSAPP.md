# WhatsApp: confirmaciones y alertas (Meta + Twilio)

El sistema envía por WhatsApp las confirmaciones de pedido a los clientes y
las alertas al equipo del negocio. Usa **Meta (WhatsApp Cloud API)** como
proveedor principal y **Twilio** como respaldo: si Meta falla, el mismo
mensaje sale por Twilio.

Todo vive en `apps/mensajeria`. Mientras no haya credenciales, el sistema
funciona igual y no envía nada.

---

## Qué se envía

| Evento | A quién | Cuándo |
|---|---|---|
| `PEDIDO_RECIBIDO` | Cliente | Se crea un pedido (tienda o panel) |
| `PEDIDO_AJUSTADO` | Cliente | El pedido pasa a **Editado** (precio del día, reemplazos) |
| `PEDIDO_CONFIRMADO` | Cliente | El pedido pasa a **Cerrado** |
| `PEDIDO_EN_CAMINO` | Cliente | El domicilio pasa a **En ruta** |
| `PEDIDO_ENTREGADO` | Cliente | El pedido pasa a **Entregado** (también la entrega por lotes) |
| `ALERTA_PEDIDO_NUEVO` | Equipo | Se crea un pedido |
| `ALERTA_MENSAJE_CONTACTO` | Equipo | Llega un mensaje del formulario de contacto |
| `ALERTA_ENVIO_DEVUELTO` | Equipo | Un domicilio vuelve sin entregarse |
| `ALERTA_GENERAL` | Equipo | Cualquier situación, desde código (ver abajo) |

Cada aviso se envía **una sola vez**, aunque el estado se guarde dos veces.
Cada evento se puede apagar por negocio desde la configuración.

---

## Cómo funciona

1. Algo pasa (un pedido nuevo, un cambio de estado) y se crea un
   `MensajeWhatsApp` **PENDIENTE**. La cola vive en la base de datos.
2. Cuando la transacción se confirma, se envía en un hilo aparte: el cliente
   no espera a Meta para ver su pedido confirmado.
3. Se intenta con el proveedor principal y, si falla, con el respaldo.
4. Si los dos fallan por algo pasajero (caída, límite de velocidad), se
   reprograma a 1, 5, 15 y 60 minutos. Si el fallo es definitivo (número
   inválido, plantilla sin aprobar), queda **FALLIDO** con el motivo.
5. Meta y Twilio informan por webhook si el mensaje se **entregó**, se
   **leyó** o **falló**.

**Un fallo de WhatsApp nunca impide guardar un pedido.**

Los reintentos salen solos con la siguiente actividad del sistema. Si hay un
cron disponible (Render de pago), conviene programar además:

```
python manage.py enviar_whatsapp          # cada minuto
```

---

## Puesta en marcha para La Gran Cosecha

### 1. Preparar el negocio

```
python manage.py migrate
python manage.py preparar_whatsapp --negocio la-gran-cosecha --alertas 3001234567
```

Esto crea la configuración (**apagada**) y una plantilla por evento con el
texto sugerido. `--alertas` son los celulares del equipo que reciben las
alertas.

### 2. Meta (proveedor principal)

1. En [Meta Business Suite](https://business.facebook.com/), crea o usa la
   cuenta de **WhatsApp Business** del negocio y registra su número.
2. En [developers.facebook.com](https://developers.facebook.com/), crea una
   app de tipo *Business* y agrégale el producto **WhatsApp**.
3. Copia el **Phone number ID** del número (WhatsApp → Configuración de la API).
   Se pone en la configuración del negocio (`meta_phone_number_id`).
4. Crea un **usuario del sistema** con permiso `whatsapp_business_messaging` y
   genera un token **permanente**. Ese es `META_WHATSAPP_TOKEN`.
   El token temporal de la consola dura 24 horas: no lo uses en producción.
5. En la app: Configuración → Básica → **Clave secreta de la app**. Esa es
   `META_APP_SECRET`.
6. Webhook (WhatsApp → Configuración):
   - URL de devolución de llamada: `https://<backend>/api/webhooks/whatsapp/meta/`
   - Token de verificación: el que tú elijas, el mismo de `META_WEBHOOK_VERIFY_TOKEN`
   - Suscribirse a: **messages**
7. Registra las plantillas en el Administrador de WhatsApp:
   - Nombre: el de `meta_nombre` (por defecto el evento en minúsculas,
     ej. `pedido_confirmado`).
   - Categoría: **Utilidad**.
   - Idioma: **Español** (código `es`, el de `meta_idioma`).
   - Cuerpo: el texto sugerido. Las variables `{{1}}`, `{{2}}`… deben ir en
     el mismo orden.

   Meta aprueba las plantillas en minutos u horas.

### 3. Twilio (respaldo)

1. En la [consola de Twilio](https://console.twilio.com/), activa un
   **WhatsApp Sender** con el número del negocio (o usa el Sandbox para probar).
   El remitente (ej. `whatsapp:+14155238886`) va en `twilio_remitente`.
2. Copia **Account SID** y **Auth Token**: `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`.
3. En **Content Template Builder**, crea una plantilla por evento con el mismo
   texto y envíala a aprobación de WhatsApp. Copia su **ContentSid** (`HX…`) en
   `twilio_content_sid` de cada plantilla.
4. Webhooks (en el Sender o el Messaging Service):
   - `TWILIO_STATUS_CALLBACK_URL=https://<backend>/api/webhooks/whatsapp/twilio/`
   - Mensajes entrantes: la misma URL.
   - `TWILIO_WEBHOOK_BASE_URL=https://<backend>` (sin barra final), para
     validar la firma detrás del proxy de Render.

### 4. Variables de entorno (Render)

Ya están declaradas en `render.yaml`; solo falta su valor:

| Variable | Para qué |
|---|---|
| `META_WHATSAPP_TOKEN` | Enviar por Meta |
| `META_APP_SECRET` | Verificar la firma de los webhooks de Meta |
| `META_WEBHOOK_VERIFY_TOKEN` | Registrar el webhook en Meta |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Enviar por Twilio y verificar sus webhooks |
| `TWILIO_STATUS_CALLBACK_URL` | Que Twilio informe entregado/fallido |
| `TWILIO_WEBHOOK_BASE_URL` | Validar la firma de Twilio detrás del proxy |

Opcionales: `META_GRAPH_VERSION` (por defecto `v21.0`), `WHATSAPP_INDICATIVO_PAIS`
(`57`), `WHATSAPP_TIMEOUT` (`10`), `WHATSAPP_ENVIO_INMEDIATO` (`True`).

Las credenciales son de la plataforma y **nunca se guardan en la base**. Lo
de cada negocio (su número, sus plantillas, a quién alertar) va en la base y
se edita desde el panel.

### 5. Probar y encender

Con la API del panel (autenticado como dueño o administrador):

```
PATCH /api/whatsapp/configuracion/   {"proveedor": "SIMULADO", "activo": true}
POST  /api/whatsapp/probar/          {"evento": "PEDIDO_CONFIRMADO", "telefono": "3001234567"}
GET   /api/whatsapp/mensajes/
```

`SIMULADO` registra los mensajes sin enviarlos: sirve para revisar textos y
disparadores. Cuando las plantillas estén aprobadas, cambia a `META` y vuelve
a probar con tu propio celular.

---

## API del panel

| Método | Ruta | Qué hace |
|---|---|---|
| GET/PATCH | `/api/whatsapp/configuracion/` | Encender/apagar, proveedor, respaldo, números, eventos apagados. Devuelve qué credenciales tiene la plataforma, sin revelarlas |
| GET/POST/PATCH/DELETE | `/api/whatsapp/plantillas/` | Plantilla por evento: nombre en Meta, ContentSid de Twilio, texto |
| POST | `/api/whatsapp/plantillas/sugeridas/` | Crea las que falten con el texto sugerido |
| GET | `/api/whatsapp/mensajes/?estado=&evento=&pedido_id=` | Historial y cola |
| POST | `/api/whatsapp/mensajes/<id>/reintentar/` | Reintentar un fallido u omitido |
| GET/POST/DELETE | `/api/whatsapp/exclusiones/` | Números que no reciben mensajes |
| POST | `/api/whatsapp/probar/` | Envío de prueba con datos de ejemplo |

Leer es de cualquier miembro del equipo; cambiar es del dueño o administrador.

---

## Enviar desde código («cualquier situación»)

```python
from apps.mensajeria import servicio

# Aviso libre al equipo (usa la plantilla ALERTA_GENERAL):
servicio.alertar(tenant, "Stock bajo", "Quedan 3 bultos de papa")

# Un evento a una persona:
servicio.encolar(tenant, "PEDIDO_CONFIRMADO", cliente.telefono_cliente,
                 {"cliente": "María", "pedido": 42, "total": "$85.000"},
                 clave="pedido:42:PEDIDO_CONFIRMADO")
```

Para una situación nueva con texto propio, añádela a `apps/mensajeria/eventos.py`
(con su orden de variables), dispárala donde ocurra y registra su plantilla en
Meta y Twilio.

---

## Consentimiento, bajas y protección de datos

- **Autorización de datos (Ley 1581).** El checkout de la tienda no deja enviar
  un pedido sin la casilla «Autorizo el tratamiento de mis datos…», y guarda la
  fecha en `Cliente.autorizo_datos_en`. A un cliente con cédula que ya autorizó
  no se le vuelve a pedir; a uno de antes se le pide una sola vez, sin repetir
  sus datos.
- **Consentimiento de WhatsApp (Meta).** Casilla opcional y desmarcada en el
  checkout; se guarda en `Cliente.acepta_whatsapp` con su fecha. Los avisos al
  cliente solo salen si lo aceptó (interruptor «Solo a clientes que aceptaron
  WhatsApp», encendido por defecto). El equipo puede registrarlo desde la ficha
  del cliente si lo autorizó por teléfono o en persona.
- **Bajas.** Si un cliente responde **BAJA**, **STOP**, **PARAR**, **CANCELAR** o
  **SALIR**, su número queda excluido y su consentimiento se retira con fecha.
  También se puede excluir desde el panel.
- Quien conozca una cédula ajena no puede suscribir ni dar de baja a esa
  persona: en un cliente ya registrado, el checkout solo completa lo que nunca
  decidió.

## Panel

Todo lo anterior se maneja en el admin-panel, en **Configuración → WhatsApp**:
encender, proveedor y respaldo, remitentes, teléfonos de alertas, avisos
activos y sus plantillas, envío de prueba, números excluidos e historial con
reintento. Lo ve todo el equipo; lo cambia el dueño o un administrador.

## Despliegue: primero la tienda

El backend ahora **rechaza los pedidos sin la autorización de datos**. Si se
despliega antes que la tienda, la tienda vieja (que no envía la casilla) no
podrá recibir pedidos hasta que se actualice. El orden seguro es:

1. Desplegar la tienda (Vercel). El backend viejo ignora los campos nuevos.
2. Desplegar el backend (Render) y correr `migrate`.
3. Desplegar el admin-panel.
