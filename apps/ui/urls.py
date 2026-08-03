from django.contrib import admin
from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

# --- CRÍTICO: Sobrescribir el login del admin ---
# Esto obliga a que el panel de administración use tu vista con OTP.
# NOTA: esto solo funciona porque se ejecuta antes de que admin.site.urls
# se evalúe más abajo. Si prefieres algo menos dependiente del orden de
# líneas, considera moverlo a apps.py -> AppConfig.ready().
admin.site.login = views.admin_login_view

urlpatterns = [
    # --- ADMIN DE DJANGO ---
    path('admin/', admin.site.urls),

    # --- ÁREA PÚBLICA (CLIENTES) ---
    path('', views.inicio, name="inicio"),
    path("contacto/", views.contacto, name="contacto"),

    # --- SISTEMA DE PEDIDOS ---
    path("hacer-pedido/", views.generar_pedido, name="crear_pedido"),

    # --- Biblioteca ----
    # FIX: se agregó el slash final para quedar consistente con el
    # resto de rutas y evitar sorpresas con APPEND_SLASH.
    path('dashboard/biblioteca/', views.biblioteca, name="biblioteca"),

    # --- DASHBOARD Y GESTIÓN ---
    path("dashboard/", views.dashboard_view, name="dashboard"),
    path("dashboard/inicio/", views.estadisticas_resumen_view, name="estadisticas-inicio"),
    path("dashboard/gestion-pedido/", views.gestion_pedidos_view, name='gestion-pedidos'),

    # FIX: slash final agregado (es un endpoint POST, más vale ser consistente).
    path('subir-imagen-producto/<int:producto_id>/', views.subir_imagen_producto, name="subir-imagen-producto"),

    path(
        'pedidos/eliminar/<int:pedido_id>/',
        views.eliminar_pedido_view,
        name='eliminar_pedido'
    ),
    path(
        'cliente/eliminar/<int:cliente_id>/',
        views.eliminar_clientes_view,
        name="eliminar_cliente"
    ),
    path(
        # FIX: el parámetro ahora se llama producto_id, igual que en la
        # firma de la vista (eliminar_producto(request, producto_id)).
        # Antes se llamaba <int:id> y causaba TypeError en cada borrado.
        'productos/eliminar/<int:producto_id>/',
        views.eliminar_producto,
        name="eliminar_producto"
    ),

    # NUEVO: borrado lógico de presentaciones individuales del catálogo
    # (el botón ya existe en el template, faltaba esta ruta).
    path(
        'presentaciones/eliminar/<int:presentacion_id>/',
        views.eliminar_presentacion,
        name="eliminar_presentacion"
    ),

    path("dashboard/catalogo/", views.gestion_catalogo, name="gestion_catalogo"),
    path("dashboard/clientes/", views.gestion_clientes, name="gestion_clientes"),
    path("dashboard/usuario/", views.gestion_usuarios, name="gestion_usuarios"),

    # --- APIS Y UTILIDADES ---
    path('api/sugerir-producto/', views.sugerir_producto, name='sugerir_producto'),
    path('api/pedidos/<int:pedido_id>/detalles/', views.detalle_pedido_api, name='detalle_pedido_api'),
    path('api/pedidos/preparar-impresion/', views.api_preparar_impresion, name="impresion_api"),
    path('usuarios/crear/', views.crear_usuario, name='crear_usuario'),
    path('usuario/eliminar/<int:usuario_id>/', views.eliminar_usuarios, name="eliminar_usuarios"),

    # FIX: se corrigió el '<int:pedido_id/' que le faltaba el '>' de
    # cierre (rompía el reverse() y la URL nunca hacía match), y se
    # movió bajo /api/pedidos/ para que coincida exactamente con el
    # fetch() que ya está en gestion_pedidos.html:
    #   fetch(`/api/pedidos/${this.pedidoEditando}/editar/`, ...)
    path('api/pedidos/<int:pedido_id>/editar/', views.editar_pedido_view, name="editar_pedido"),

    # NUEVO: acción masiva "Entregar Seleccionados" (ya conectada en el
    # template, faltaba esta ruta).
    path('api/pedidos/entregar/', views.entregar_pedidos_view, name="entregar_pedidos"),

    path('pedido/<int:pedido_id>/pdf/', views.generar_pdf_pedido, name="generar_pdf_pedido"),

    # NUEVO: PDF de impresión por lote (varios pedidos, un solo PDF con
    # una hoja por pedido). Reemplaza al flujo roto del modal Alpine
    # que usaba /api/pedidos/preparar-impresion/ + un <template
    # x-teleport> con dos hijos (bug que impedía que se mostrara).
    path('pedidos/lote/pdf/', views.generar_pdf_pedidos_lote, name="generar_pdf_pedidos_lote"),

    path("dashboard/usuario/cerrar_sesion/", views.cerrar_sesion_remota, name="cerrar_sesion_remota"),

    # --- AUTENTICACIÓN ADMINISTRATIVA (OTP) ---
    path("login/", views.admin_login_view, name="login"),
    path("logout/", auth_views.LogoutView.as_view(next_page='login'), name="logout"),
]