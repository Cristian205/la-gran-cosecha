"""
Campos de serializer con ámbito de negocio.

Resuelven un vector de fuga que ni el manager ni el ViewSet alcanzan: los
`PrimaryKeyRelatedField` de DRF validan el id que llega en el cuerpo contra su
propio queryset, no contra el de la vista. Con
`queryset=PresentacionProducto.objects.all()` escrito a nivel de clase, la
tienda de un negocio aceptaba un pedido que referenciaba el producto de otro —
y le calculaba el precio del vecino.

Hay además una razón mecánica: un `queryset=` a nivel de clase se evalúa al
importar el módulo, fuera de toda petición. Con el manager acotado eso sería un
`SinTenantEnContexto` durante el arranque de Django.
"""
from rest_framework import serializers


class ClaveDelNegocio(serializers.PrimaryKeyRelatedField):
    """
    Como `PrimaryKeyRelatedField`, pero solo acepta ids del negocio de la
    petición.

    Un id de otro negocio no da 403 sino un error de validación normal ("objeto
    inexistente"), que es lo correcto: para quien pregunta, ese objeto no
    existe.

        presentacion_id = ClaveDelNegocio(PresentacionProducto, source="presentacion")
    """

    def __init__(self, modelo, **kwargs):
        self._modelo = modelo
        # `all_tenants` no lanza sin contexto, y como QuerySet perezoso no toca
        # la base al importar. El filtro real lo pone `get_queryset()`.
        kwargs.setdefault("queryset", modelo.all_tenants.none())
        super().__init__(**kwargs)

    def get_queryset(self):
        tenant = self.context.get("tenant")
        if tenant is None:
            peticion = self.context.get("request")
            tenant = getattr(peticion, "tenant", None)

        base = self._modelo.all_tenants.all()
        # Sin negocio resuelto no se acepta ninguna referencia: falla cerrado,
        # igual que el manager.
        return base.filter(tenant=tenant) if tenant is not None else base.none()
