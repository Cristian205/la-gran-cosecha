"""
La Gran Cosecha (y su plantilla), Inicio: la onda orgánica entre todas sus
secciones.

Una `separador` variante `onda` entre cada par de bloques seguidos (no antes
del primero ni después del último: arriba está la cabecera y abajo el pie).
Se alternan en espejo para que la curva no se repita idéntica sección tras
sección. Sin espacio extra (`espacio: 0`): la propia onda es la transición.

Son bloques normales del constructor: cada onda se mueve, voltea o quita
desde ahí. Como en 0067/0068, lo publicado se archiva con una versión nueva
y cada paso comprueba antes de escribir (si ya hay ondas de esta migración,
no hace nada).
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/"
PREFIJO = "separador-onda-inicio"


def _onda(indice):
    return {
        "id": f"{PREFIJO}-{indice}",
        "tipo": "separador",
        "variante": "onda",
        "props": {"espacio": 0, "espejo": indice % 2 == 1},
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def _con_ondas(composicion):
    if not isinstance(composicion, list) or len(composicion) < 2:
        return None
    if any(isinstance(b, dict) and str(b.get("id", "")).startswith(PREFIJO) for b in composicion):
        return None
    nueva = []
    for i, bloque in enumerate(composicion):
        if i > 0:
            anterior = composicion[i - 1]
            # No se pone onda junto a un separador que ya esté ahí.
            if not (
                isinstance(bloque, dict)
                and isinstance(anterior, dict)
                and "separador" in (bloque.get("tipo"), anterior.get("tipo"))
            ):
                nueva.append(_onda(i))
        nueva.append(bloque)
    return nueva


def _transformar(apps, transformar, nota):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Tenant = apps.get_model("tenancy", "Tenant")

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = transformar(paginas.get(RUTA))
        if nueva is not None:
            paginas[RUTA] = nueva
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta=RUTA).first()
    if pagina is None:
        return

    for borrador in pagina.versiones.filter(estado="BORRADOR"):
        nueva = transformar(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    nueva = transformar(publicada.composicion)
    if nueva is None:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])
    ultimo_numero = pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva,
        nota=nota,
        fecha_publicacion=timezone.now(),
    )


def aplicar(apps, schema_editor):
    _transformar(apps, _con_ondas, "Onda orgánica entre todas las secciones del Inicio.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0068_onda_sobre_favoritos")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
