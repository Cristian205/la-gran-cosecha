"""
Catálogo curado de permisos que se pueden asignar a un usuario que NO es
dueño de la cuenta (GERENTE/superusuario). Se apoya en los permisos de
Django que ya existen automáticamente por modelo (add_/change_/delete_).
"""

CATALOGO_PERMISOS = [
    {
        "modulo": "Catálogo",
        "permisos": [
            {"codename": "catalog.view_producto", "etiqueta": "Ver catálogo"},
            {"codename": "catalog.change_producto", "etiqueta": "Editar productos"},
            {"codename": "catalog.delete_producto", "etiqueta": "Eliminar / desactivar productos"},
        ],
    },
    {
        "modulo": "Pedidos",
        "permisos": [
            {"codename": "orders.view_pedido", "etiqueta": "Ver pedidos y productos pendientes"},
            {"codename": "orders.change_pedido", "etiqueta": "Editar y entregar pedidos"},
            {"codename": "orders.delete_pedido", "etiqueta": "Eliminar pedidos"},
        ],
    },
    {
        "modulo": "Inventario",
        "permisos": [
            {"codename": "inventory.view_existencia", "etiqueta": "Ver existencias y kardex"},
            {
                "codename": "inventory.change_existencia",
                "etiqueta": "Registrar entradas, ajustes y traslados",
            },
        ],
    },
    {
        "modulo": "Punto de venta",
        "permisos": [
            {"codename": "pos.add_venta", "etiqueta": "Vender en caja"},
            {"codename": "pos.change_turno", "etiqueta": "Abrir y cerrar caja, medios de pago"},
            {"codename": "pos.delete_venta", "etiqueta": "Anular ventas"},
        ],
    },
    {
        "modulo": "Reservas",
        "permisos": [
            {"codename": "reservations.view_reserva", "etiqueta": "Ver la agenda"},
            {"codename": "reservations.add_reserva", "etiqueta": "Crear y mover reservas"},
            {
                "codename": "reservations.change_recurso",
                "etiqueta": "Administrar mesas y recursos",
            },
        ],
    },
    {
        "modulo": "Clientes",
        "permisos": [
            {"codename": "orders.view_cliente", "etiqueta": "Ver clientes"},
            {"codename": "orders.change_cliente", "etiqueta": "Editar clientes"},
            {"codename": "orders.delete_cliente", "etiqueta": "Eliminar clientes"},
        ],
    },
    {
        "modulo": "Usuarios",
        "permisos": [
            {"codename": "accounts.view_usuario", "etiqueta": "Ver usuarios"},
            {"codename": "accounts.add_usuario", "etiqueta": "Crear usuarios"},
            {"codename": "accounts.change_usuario", "etiqueta": "Editar usuarios"},
            {"codename": "accounts.delete_usuario", "etiqueta": "Eliminar usuarios"},
        ],
    },
    {
        "modulo": "Contenido",
        "permisos": [
            {"codename": "content.view_promobanner", "etiqueta": "Ver sección de contenido"},
        ],
    },
]

TODOS_LOS_CODENAMES = {
    p["codename"] for modulo in CATALOGO_PERMISOS for p in modulo["permisos"]
}
