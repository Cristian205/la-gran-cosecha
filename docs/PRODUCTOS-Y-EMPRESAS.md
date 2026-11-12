# Productos y Empresas — diagnóstico y propuesta de evolución

Estado a la fecha de esta auditoría, qué se implementó en la **Fase A** (sin
tocar la base de datos) y qué propone la **Fase B** (modelos nuevos), que
necesita aprobación antes de construirse.

## 1. Cómo funciona hoy

| Concepto | Dónde vive | Notas |
| --- | --- | --- |
| Producto | `billing.Producto` | slug, nombre, descripción, categoría, ícono, estado (BORRADOR / ACTIVO / ARCHIVADO), orden. |
| Módulo | `PermisoDisponible.modulo` (texto) | No es una tabla: es la etiqueta con la que se agrupan los permisos de un producto. |
| Funcionalidad | `billing.Caracteristica` | Lo que un plan promete y no es un permiso (soporte, SLA). FK opcional a producto; M2M con plan. |
| Permiso | `billing.PermisoDisponible` | `codename` único; FK opcional a producto. Es lo que la app comprueba. |
| Plan | `billing.Plan` | Permisos en JSON, límites en JSON, versión (`version`, `origen`), M2M a características. Los precios van en `PrecioPlan` con vigencia. |
| Contrato | `billing.Subscription` | **1:1 con la empresa**: un plan, moneda/periodicidad/importe pactados, `limites_extra`, `permisos_extra`, `permisos_excluidos`. |
| Empresa | `tenancy.Tenant` (API `platform/tenants`) | Estado PRUEBA / ACTIVO / SUSPENDIDO / ARCHIVADO. |

Un producto **no pertenece a ninguna empresa**: la empresa lo tiene si su plan
(o sus permisos extra) concede alguno de sus permisos. `Plan.productos` se
deduce de los permisos a propósito, para que un plan no pueda "incluir" un
producto sin conceder nada.

### Lo que ya funciona
- Empresas: listado con tabla y tarjetas, búsqueda, filtros (estado, plan,
  salud, uso, módulos), orden por columnas, paginación, acciones y detalle con
  pestañas (Resumen, Suscripción, Módulos, Usuarios, Dominios, Uso, Actividad,
  Identidad).
- Ajuste por empresa de permisos (extras y excluidos) sin tocar el plan.
- Planes versionados (`duplicar(nueva_version=True)`), con precios con vigencia.
- Archivado en lugar de borrado para productos con permisos.

### Lo que no existe
- **Asignación explícita empresa ↔ producto** (con plan, límites y estado propios).
- **Más de un plan por empresa** (la suscripción es 1:1).
- **Tipo de producto** (software / módulo / servicio / solución a medida).
- **Versiones del producto** y **imagen** del producto.
- **Registro de auditoría**: la pantalla Auditoría dice "todavía no existe";
  la pestaña Actividad de una empresa se arma con altas y cambios de suscripción.
- Consumo medido para todos los límites (solo algunos `TipoLimite` son `medido`).

## 2. Fase A — implementada (sin cambios en BD ni endpoints)

**Productos** (`panel-kryonx/src/paginas/Productos.tsx`, `ProductoFicha.tsx`)
- Catálogo en tabla y tarjetas, con búsqueda (nombre, identificador, categoría),
  filtros por categoría y estado, orden por columnas y paginación.
- Cifras: publicados, borradores, archivados.
- Alta como **borrador**, con validación de nombre e identificador duplicados.
- Ficha con pestañas: General · Módulos · Funcionalidades · Permisos · Planes y
  precios · Empresas · Versiones. Indicador de cambios sin guardar y aviso al
  salir. «Empresas» y «Planes» se **deducen** de los datos reales.
- Retirar: confirma el alcance (empresas y planes) y archiva si hay permisos,
  de modo que ninguna empresa pierde lo que tiene.

**Empresas**
- Cifras nuevas en la cabecera: en prueba y suspendidas.
- Pestaña **Productos** en el detalle: por producto, cobertura (completo /
  parcial / no contratado), origen (plan o extra) y acción Habilitar / Completar
  / Quitar **solo para esa empresa** (escribe `permisos_extra` /
  `permisos_excluidos` de su suscripción; ni el producto ni el plan cambian).

**Protección de contratos en Fase A**: las excepciones por empresa viven en su
suscripción, no en el producto, y los productos con permisos nunca se borran.
Lo que **no** protege: si se cambian los permisos de un plan, las empresas de
ese plan cambian. Para eso se usa `duplicar(nueva_version=True)`.

## 3. Fase B — propuesta (requiere aprobación)

Objetivo: que lo contratado por una empresa sea un **dato propio**, congelado,
y no una consecuencia del catálogo.

### Modelos nuevos
1. `Producto.tipo` — `SOFTWARE | MODULO | SERVICIO | PERSONALIZADO` (default
   `SOFTWARE`). Columna nueva con valor por defecto: compatible con lo existente.
2. `Producto.imagen` — opcional.
3. `VersionProducto` — `producto`, `numero`, `notas`, `fecha`, `publicada_por`.
   Se crea una versión al publicar o al cambiar permisos del producto.
4. `AsignacionProducto` — `tenant`, `producto`, `plan` (nullable), `estado`
   (ACTIVA / PAUSADA / CANCELADA), `limites` (JSON), `permisos` (JSON,
   **congelados** al asignar), `version_producto`, `fecha_inicio`, `fecha_fin`.
   Restricción única `(tenant, producto)` mientras esté ACTIVA.
5. `HistorialAsignacion` — `asignacion`, `accion`, `antes`, `despues`, `usuario`,
   `fecha`. Alimenta Actividad y una futura Auditoría.

### Reglas
- **Snapshot**: al asignar se copian los permisos y límites vigentes. Editar el
  producto o el plan después **no** altera la asignación; solo se actualiza si
  alguien la "migra" a una versión nueva, con confirmación y registro.
- **Eliminación**: un producto con asignaciones ACTIVAS no se puede archivar sin
  elegir qué pasa con ellas.
- **Coexistencia**: `Subscription` sigue siendo el contrato comercial (precio,
  moneda, periodicidad). La autorización efectiva pasaría a ser la unión de las
  asignaciones activas, con `permisos_extra/excluidos` aún soportados.

### Migración de datos existentes
Una migración de datos recorre cada `Subscription` vigente y crea una
`AsignacionProducto` por producto cubierto, con los permisos que hoy tiene
efectivos. Es reversible (se puede borrar el contenido de las tablas nuevas) y
no modifica `Subscription`, `Plan` ni `Producto` existentes.

### Endpoints nuevos
`GET/POST /platform/assignments/`, `PATCH /platform/assignments/{id}/`,
`GET /platform/assignments/{id}/history/`, `GET /platform/products/{id}/versions/`,
`GET /platform/products/{id}/tenants/`, `GET /platform/tenants/{id}/products/`.
Permisos: los mismos que la plataforma ya exige (`BaseDePlataforma`).

### Riesgo y despliegue
Las migraciones se ejecutan al arrancar el contenedor (`Dockerfile`) contra la
base compartida con producción. Son aditivas (tablas y columnas nuevas con
defaults), pero conviene desplegarlas primero a un entorno de prueba y respaldar
antes de la migración de datos.

## 4. Pendiente

- Aprobar o ajustar la Fase B.
- Auditoría real (hoy no existe) — la Fase B la habilita con `HistorialAsignacion`.
- Salud, consumo por producto y renovación por producto: dependen de asignaciones.
- Tipo, imagen y versiones del producto: dependen de la Fase B.
- Filtro de empresas por producto (en el listado) y selección múltiple.
