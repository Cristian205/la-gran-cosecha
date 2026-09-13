"""
La marquesina separa el Hero del resto del Home.

Se inserta justo después de `portada` en la composición publicada de "/" de
La Gran Cosecha — quirúrgico, como `0030`/`0032`: se lee la versión vigente,
se añade un bloque en el punto exacto y se deja todo lo demás intacto.

Las frases son mensajes de marca cortos (frescura, entrega, para quién es el
negocio), no datos de catálogo ni cifras — no hay nada que inventar o
verificar contra el backend.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

FRASES = {
    "items": [
        {"texto": "Productos frescos, todos los días", "icono": "hoja"},
        {"texto": "Entrega directa a tu negocio", "icono": "camion"},
        {"texto": "Para restaurantes, tiendas y hoteles", "icono": "edificio"},
        {"texto": "Pedidos armados en minutos", "icono": "reloj"},
        {"texto": "Calidad seleccionada", "icono": "escudo"},
    ],
    "velocidad": 26,
}


def normalizar(bruto, indice):
    return {
        "id": f"{bruto['tipo']}-{indice}",
        "tipo": bruto["tipo"],
        "variante": bruto.get("variante", ""),
        "props": bruto.get("props", {}),
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def aplicar(apps, schema_editor):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    composicion = publicada.composicion
    if any(b.get("tipo") == "marquesina" for b in composicion):
        return  # ya está: no se duplica si esto se corre dos veces.

    nueva = []
    insertada = False
    for bloque in composicion:
        nueva.append(bloque)
        if not insertada and bloque.get("tipo") == "portada":
            nueva.append(normalizar({"tipo": "marquesina", "variante": "oscura", "props": FRASES}, len(nueva)))
            insertada = True

    if not insertada:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])

    ultimo_numero = (
        pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    )
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva,
        nota="Marquesina entre el Hero y el resto del Home.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0035_bloque_marquesina")]

    operations = [migrations.RunPython(aplicar, revertir)]
