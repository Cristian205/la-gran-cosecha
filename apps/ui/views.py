import random, os, base64, json
import secrets
import string
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from django.views.decorators.clickjacking import xframe_options_exempt
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db.models import Count
from django.contrib import messages
from collections import OrderedDict
from django.db.models import Prefetch, Sum
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.decorators import login_required
from django.contrib.sessions.models import Session
from django.db import models
from dateutil.relativedelta import relativedelta
from django.template.loader import get_template
from django.template.loader import render_to_string
from weasyprint import HTML
from collections import defaultdict
from django.db.models import Q
from django.db import transaction
from django.http import JsonResponse, HttpResponse
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.db.models.functions import TruncDay
from django.views.decorators.http import require_POST, require_GET
from django.core.mail import send_mail

from django.contrib.auth.hashers import make_password, check_password

# Importación de modelos
from .models import (
    Categoria, Producto, Usuario, PresentacionProducto,
    UnidadMedida, Pedido, Cliente, DetallePedido, HistorialDetallePedido,
    HistorialPrecio
)

# --- VISTAS PÚBLICAS ---


def index(request):
    return render(request, "ui/index.html")


def inicio(request):
    return render(request, "ui/pages/inicio.html")


def contacto(request):
    return render(request, "ui/pages/contacto.html")


# --- SISTEMA DE PEDIDOS (OPERATIVO) ---

def crear_pedido(request):

    # =========================================================
    # FECHA + ÚLTIMO ID
    # =========================================================
    fecha_manana = timezone.localtime() + timedelta(days=1)

    ultimo_pedido = (
        Pedido.objects
        .only('id')
        .order_by('id')
        .last()
    )

    ultimo_pedido = Pedido.objects.order_by('-id').first()

    ultimo_id = ultimo_pedido.id if ultimo_pedido else 0

    # =========================================================
    # POST
    # =========================================================
    if request.method == 'POST':

        nombre_capturado = (
            request.POST.get('cliente_nombre', '')
            .strip()
            .upper()
        )

        # =========================================================
        # VALIDACIÓN
        # =========================================================
        if not nombre_capturado:

            return JsonResponse({
                'status': 'error',
                'message': 'Debes ingresar el nombre del establecimiento.'
            }, status=400)

        try:

            with transaction.atomic():

                # =========================================================
                # CLIENTE
                # =========================================================
                cliente, _ = Cliente.objects.get_or_create(

                    nombre_cliente=nombre_capturado,

                    defaults={
                        'direccion_cliente': 'Bogotá',
                        'telefono_cliente': '0000'
                    }

                )

                # =========================================================
                # USUARIO
                # =========================================================
                if request.user.is_authenticated:

                    usuario_responsable = request.user

                else:

                    usuario_responsable = (
                        Usuario.objects
                        .filter(is_active=True)
                        .first()
                    )

                if not usuario_responsable:

                    return JsonResponse({
                        'status': 'error',
                        'message': (
                            'No existe un usuario activo disponible.'
                        )
                    }, status=500)

                # =========================================================
                # CREAR PEDIDO
                # =========================================================
                nuevo_pedido = Pedido.objects.create(

                    usuario=usuario_responsable,
                    cliente=cliente,
                    estado='PENDIENTE'

                )

                # =========================================================
                # PRODUCTOS CATÁLOGO
                # =========================================================
                for key in request.POST.keys():

                    if (
                        key.startswith('prod_')
                        and key.endswith('_cantidad')
                    ):

                        try:

                            prod_id = key.split('_')[1]

                        except IndexError:
                            continue

                        cantidad_raw = request.POST.get(key, '0')

                        try:

                            cantidad = Decimal(
                                str(cantidad_raw)
                                .replace(',', '.')
                            )

                        except (InvalidOperation, TypeError):

                            cantidad = Decimal('0')

                        if cantidad <= 0:
                            continue

                        # =========================================================
                        # PRESENTACIÓN
                        # =========================================================
                        pres_id = request.POST.get(
                            f'prod_{prod_id}_presentacion'
                        )

                        if not pres_id:
                            continue

                        presentacion = (
                            PresentacionProducto.objects
                            .filter(
                                id=pres_id,
                                estado_presentacion=True
                            )
                            .first()
                        )

                        if not presentacion:
                            continue

                        # =========================================================
                        # DETALLE
                        # =========================================================
                        DetallePedido.objects.create(

                            pedido=nuevo_pedido,
                            presentacion=presentacion,
                            cantidad=cantidad

                        )

                # =========================================================
                # PRODUCTOS MANUALES
                # =========================================================
                processed_custom = set()

                for key in request.POST.keys():

                    if key.startswith('custom_nombre_'):

                        cat_id = (
                            key.replace('custom_nombre_', '')
                            .replace('[]', '')
                        )

                        if cat_id in processed_custom:
                            continue

                        processed_custom.add(cat_id)

                        nombres_lista = request.POST.getlist(key)

                        cantidades_lista = request.POST.getlist(
                            f'custom_cant_{cat_id}[]'
                        )

                        unidades_lista = request.POST.getlist(
                            f'custom_uni_{cat_id}[]'
                        )

                        max_len = min(

                            len(nombres_lista),
                            len(cantidades_lista),
                            len(unidades_lista)

                        )

                        for i in range(max_len):

                            nombre = nombres_lista[i].strip()

                            cant = cantidades_lista[i]

                            uni_id = unidades_lista[i]

                            try:

                                cantidad_manual = Decimal(
                                    str(cant)
                                    .replace(',', '.')
                                )

                            except (InvalidOperation, TypeError):

                                cantidad_manual = Decimal('0')

                            if not nombre or cantidad_manual <= 0:
                                continue

                            # =========================================================
                            # UNIDAD
                            # =========================================================
                            unidad_txt = ""

                            if uni_id:

                                unidad = (
                                    UnidadMedida.objects
                                    .filter(id=uni_id)
                                    .first()
                                )

                                if unidad:

                                    unidad_txt = (
                                        f" ({unidad.abreviatura_unidad})"
                                    )

                            # =========================================================
                            # DETALLE MANUAL
                            # =========================================================
                            DetallePedido.objects.create(

                                pedido=nuevo_pedido,

                                nombre_personalizado=(
                                    f"{nombre.upper()}{unidad_txt}"
                                ),

                                cantidad=cantidad_manual,
                                presentacion=None

                            )

                # =========================================================
                # SESSION
                # =========================================================
                request.session[
                    'ultimo_id_generado'
                ] = nuevo_pedido.id

                # =========================================================
                # RESPONSE
                # =========================================================
                return JsonResponse({

                    'status': 'success',

                    'pedido_id': nuevo_pedido.id,

                    'message': (
                        f'Gracias {nombre_capturado}, '
                        f'tu pedido #{nuevo_pedido.id} '
                        f'ha sido registrado correctamente.'
                    )

                })

        except Exception as e:

            import traceback
            traceback.print_exc()

            return JsonResponse({

                'status': 'error',
                'message': f'Error inesperado: {str(e)}'

            }, status=500)

    # =========================================================
    # GET
    # =========================================================

    # =========================================================
    # UNIDADES
    # =========================================================
    unidades_db = (

        UnidadMedida.objects

        .filter(
            estado_unidad=True
        )

        .order_by('nombre_unidad')

    )

    # =========================================================
    # CATEGORÍAS
    # =========================================================

    categorias_qs = Categoria.objects.filter(
        estado_categoria=True
    ).prefetch_related(
        Prefetch(
            'productos',
            queryset=Producto.objects.filter(
                estado_producto=True
            ).prefetch_related(

                Prefetch(

                    'presentaciones',

                    queryset=PresentacionProducto.objects.filter(
                        estado_presentacion=True
                    ).select_related('unidad_venta')

                )

            )

        )

    )

    # =========================================================
    # PREPARAR PRESENTACIONES
    # =========================================================
    for categoria in categorias_qs:

        productos_lista = []

        for producto in categoria.productos.all():

            grouped = {}

            for pres in producto.presentaciones.all():

                nombre_pres = pres.nombre_presentacion or 'GENERAL'

                if nombre_pres not in grouped:
                    grouped[nombre_pres] = []

                grouped[nombre_pres].append({

                    'id': pres.id,

                    'unidad': (
                        pres.unidad_venta.abreviatura_unidad
                        if pres.unidad_venta else ''
                    ),

                    'precio': str(
                        pres.precio_unitario or 0
                    ),

                    'factor': str(
                        pres.factor_conversion or 1
                    )

                })
                print(
                    producto.nombre_producto,
                    producto.presentaciones.count(),
                    len(grouped)
                )

            producto.presentaciones_grouped = list(
                grouped.items()
            )

            producto.presentaciones_json = json.dumps([
                {
                    "nombre": nombre,
                    "variantes": variantes
                }
                for nombre, variantes in grouped.items()
            ])

            productos_lista.append(producto)

        categoria.productos_preparados = productos_lista
        categoria.total_productos = len(productos_lista)
    # =========================================================
    # CONTEXT
    # =========================================================
    context = {

        'categorias': categorias_qs,
        'unidades_db': unidades_db,
        'ultimo_id': ultimo_id,
        'fecha_entrega': fecha_manana,
        'titulo': 'Nueva Orden de Venta',

    }

    # =========================================================
    # RENDER
    # =========================================================
    return render(

        request,
        'ui/pages/hacer_pedido.html',
        context

    )
def busqueda_producto_campo_adicional(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return JsonResponse({'found': False})
    producto = Producto.objects.filter(
        nombre_producto__icontains=q,
        estado_producto=True
    ).prefetch_related('presentaciones__unidad_venta').first()
    
    if not producto:
        return JsonResponse({"found": False})
    
    return JsonResponse({
        'found': True,
        'nombre': producto.nombre_producto,
        'presentaciones': [
            {
                'id': p.id,
                'nombre_presentacion': p.nombre_presentacion,
                'unidad': p.unidad_venta.abreviatura_unidad
            }
            for p in producto.presentaciones.all()
        ]
    })
    
def sugerir_producto(request):

    q = request.GET.get('q', '').strip()

    categoria_id = request.GET.get(
        'categoria'
    )

    if len(q) < 2:
        return JsonResponse({
            'found': False
        })

    productos = Producto.objects.filter(
        nombre_producto__icontains=q,
        estado_producto=True,
        categoria_id=categoria_id
    )

    producto = productos.first()

    if not producto:
        return JsonResponse({
            'found': False
        })

    return JsonResponse({
        'found': True,
        'producto_id': producto.id,
        'categoria_id': producto.categoria_id,
        'nombre': producto.nombre_producto,
        'presentaciones': [
            {
                'id': p.id,
                'nombre_presentacion': (
                    p.nombre_presentacion
                ),
                'unidad': (
                    p.unidad_venta.abreviatura_unidad
                    if p.unidad_venta
                    else ''
                )
            }
            for p in producto.presentaciones.all()
        ]
    })
    
def _obtener_datos_factura(pedido):
    """
    Arma el diccionario de contexto (categorías, fecha de entrega, etc.)
    para UN pedido. No incluye 'logo_data' porque ese es el mismo para
    todos los pedidos y se resuelve una sola vez en el llamador.
    """
    detalles = pedido.detalles.select_related(
        'presentacion__producto__categoria',
        'presentacion__unidad_venta',
        'categoria_manual',
        'unidad_personalizada'
    ).order_by(
        'presentacion__producto__categoria__orden',
        'presentacion__producto__orden',
        'presentacion__producto__nombre_producto'
    )
 
    dias_entrega = 1
    fecha_entrega = pedido.fecha_pedido + timedelta(days=dias_entrega)
 
    categorias_normales = OrderedDict()
    categorias_especiales = OrderedDict()
 
    ESPECIALES = [
        "DESECHABLES",
        "SALSAMENTARIA"
    ]
 
    for d in detalles:
 
        # ==================================
        # PRODUCTO DE CATÁLOGO
        # ==================================
        if d.presentacion:
            cat_obj = d.presentacion.producto.categoria
            articulo = d.presentacion.producto.nombre_producto
            pres = d.presentacion.nombre_presentacion
            unidad = d.presentacion.unidad_venta.abreviatura_unidad
            subtotal = d.subtotal
 
        # ==================================
        # PRODUCTO MANUAL
        # ==================================
        else:
            cat_obj = d.categoria_manual
            articulo = d.nombre_personalizado
            pres = "MANUAL"
            unidad = (
                d.unidad_personalizada.abreviatura_unidad
                if d.unidad_personalizada
                else ""
            )
            subtotal = d.subtotal or 0
 
        # ==================================
        # SIN CATEGORÍA
        # ==================================
        if not cat_obj:
            if "OTROS" not in categorias_especiales:
                categorias_especiales["OTROS"] = []
 
            categorias_especiales["OTROS"].append({
                'articulo': articulo,
                'pres': pres,
                'unidad': unidad,
                'cant': d.cantidad,
                'subtotal': subtotal
            })
            continue
 
        # ==================================
        # CLASIFICAR CATEGORÍA
        # ==================================
        nombre_upper = cat_obj.nombre_categoria.upper()
 
        target_dict = (
            categorias_especiales
            if nombre_upper in ESPECIALES
            else categorias_normales
        )
 
        if cat_obj not in target_dict:
            target_dict[cat_obj] = []
 
        target_dict[cat_obj].append({
            'articulo': articulo,
            'pres': pres,
            'unidad': unidad,
            'cant': d.cantidad,
            'subtotal': subtotal
        })
 
    return {
        'pedido': pedido,
        'categorias_normales': categorias_normales,
        'categorias_especiales': categorias_especiales,
        'fecha_entrega': fecha_entrega,
    }
 
@xframe_options_exempt
def generar_pdf_pedido(request, pedido_id):
    try:
        pedido = Pedido.objects.select_related('cliente').get(id=pedido_id)
 
        context = _obtener_datos_factura(pedido)
        context['logo_data'] = _obtener_logo_base64()
        context['fecha_impresion'] = pedido.fecha_pedido
 
        html_string = render_to_string(
            'ui/pages/Dashboard/ui/pdf/formato_factura.html',
            context
        )
 
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = (
            f'inline; filename="Pedido_{pedido_id}.pdf"'
        )
 
        HTML(
            string=html_string,
            base_url=request.build_absolute_uri()
        ).write_pdf(response)
 
        return response
 
    except Pedido.DoesNotExist:
        return HttpResponse(
            "Error: El pedido solicitado no existe.",
            status=404
        )
 
    except Exception as e:
        print(f"CRITICAL ERROR PDF: {e}")
        return HttpResponse(
            f"Error al generar PDF: {str(e)}",
            status=500
        )
 
def _obtener_logo_base64():
    """Lee el logo una sola vez y lo devuelve en base64 (o '' si no existe)."""
    logo_path = os.path.join(
        settings.BASE_DIR,
        'apps',
        'ui',
        'static',
        'ui',
        'img',
        'logo_la_gran_cosecha.png'
    )
 
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
 
    return ""

@login_required
@xframe_options_exempt
def generar_pdf_pedidos_lote(request):
 
    if not request.user.is_staff:
        return HttpResponse("No autorizado", status=403)
 
    ids_param = request.GET.get('ids', '')
    ids = [i for i in ids_param.split(',') if i.strip().isdigit()]
 
    if not ids:
        return HttpResponse(
            "No se especificaron pedidos válidos.",
            status=400
        )
 
    # Respeta el orden en que el usuario seleccionó los pedidos
    orden = {int(i): idx for idx, i in enumerate(ids)}
 
    pedidos_qs = Pedido.objects.select_related('cliente').filter(id__in=ids)
    pedidos_ordenados = sorted(
        pedidos_qs,
        key=lambda p: orden.get(p.id, 0)
    )
 
    if not pedidos_ordenados:
        return HttpResponse(
            "Ninguno de los pedidos solicitados existe.",
            status=404
        )
 
    logo_base64 = _obtener_logo_base64()
 
    pedidos_data = [
        _obtener_datos_factura(p) for p in pedidos_ordenados
    ]
 
    context = {
        'pedidos_data': pedidos_data,
        'logo_data': logo_base64,
    }
 
    html_string = render_to_string(
        'ui/pages/Dashboard/ui/pdf/formato_factura_lote.html',
        context
    )
 
    response = HttpResponse(content_type='application/pdf')
 
    ids_str = "-".join(str(p.id) for p in pedidos_ordenados)
    response['Content-Disposition'] = (
        f'inline; filename="Pedidos_{ids_str}.pdf"'
    )
 
    HTML(
        string=html_string,
        base_url=request.build_absolute_uri()
    ).write_pdf(response)
 
    return response
    
# --- AUTENTICACIÓN ADMINISTRATIVA (2FA) ---
def admin_login_view(request):
    """Autenticación OTP / 2FA para usuarios administrativos de la plataforma"""
    # Si el usuario ya inicio sesión 
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    
    # ============= Metodo Get ===========
    if request.method== "GET":
        return render(
            request,
            'ui/pages/Dashboard/Login/Login.html',
            {'step':1}
        )
        
    # ============ Metodo Post =============
    if request.method == 'POST':
        # ================== Paso 2: Validar Código OTP ============
        if request.POST.get('otp_token'):
            otp_ingresado = request.POST.get('otp_token')
            user_uid = request.session.get('pre_auth_user_uid')
            
            
            # Validación de sesión OTP
            if not user_uid:
                
                return JsonResponse({
                    'success': False,
                    'message': 'La sesión de verificación del código expiró. Inicie sesión nuevamente.'
                }, status=400)
            
            try :
                user = Usuario.objects.get(uid=user_uid)
                
                #Validar expiración del token 
                if not user.token_expiracion:
                    
                    return JsonResponse({
                        'success': False,
                        'message': 'El código OTP no existe.'
                    }, status=400)
                    
                    
                if timezone.now() > user.token_expiracion:
                    
                    return JsonResponse({
                        'success': False,
                        'message': 'El código OTP ha expirado.'
                    }, status=400)
                    
                # Validar OTP
                otp_valido = check_password(
                    otp_ingresado,
                    user.token_verificacion
                )
                
                if not otp_valido:
                    user.intentos_fallidos += 1
                    user.save()
                    
                    return JsonResponse({
                        'success': False,
                        'message': 'Código de seguridad incorrecto.'
                    }, status=400)
                    
                # Validar bloqueo 
                if user.esta_bloqueado():
                    
                    return JsonResponse({
                        'success': False,
                        'message': 'Cuenta bloqueada temporalmente.'
                    }, status=403)
                    
                    
                    
                # ======= Validació correcta de Login ========
                login(request, user)
                
                #Actualizar datos 
                user.ultimo_login_exitoso = timezone.now()
                user.intentos_fallidos = 0
                user.token_expiracion = None
                user.token_verificacion = None
                user.save()
                
                #Limpiar sesión OTP
                request.session.pop('pre_auth_user_uid', None)
                
                return JsonResponse({
                    'success': True,
                    'redirect_url': reverse('estadisticas-inicio')
                })
                
            except Usuario.DoesNotExist:
                
                return JsonResponse({
                    'success': False,
                    'message': 'Usuario no encontrado en el sistema.'
                }, status=404)
                
            except Exception as e:
                print('Error OTP', str(e))
                
                return JsonResponse({
                    'success': False,
                    'message': 'Ocurrió un error validando el código OTP.'
                }, status=500)
                
                
        # ============ Validar credenciales ===================
        
        else:
            email = request.POST.get('email_usuario')
            password = request.POST.get('password')
            
            user = authenticate(
                request,
                email_usuario = email,
                password = password
            )
            
            # Credencialess inválidas
            if user is None:
                return JsonResponse({
                    'successs': False,
                    'message': 'Credenciales incorrectas..'
                }, status=400)
    
            #Usuario deshabilitado o bloqueado
            if not user.is_active or user.esta_bloqueado():
                return JsonResponse({
                    'success': False,
                    'message': 'La cuenta está bloqueada o no tiene ningún acceso.'
                }, status= 403)
                
            try: 
                
                # ======================= Generar código OTP ===================
                otp_code = str(random.randint(100000, 999999))
                
                # Guardar Hash del OTP
                user.token_verificacion = make_password(otp_code)
                
                # Expiración del código OTP
                user.token_expiracion = timezone.now() + timezone.timedelta(minutes=10)
                
                user.save()
                
                
                # ================ Sesión Pre auth ===================
                request.session['pre_auth_user_uid'] = str(user.uid)
                
                #Expiración de código en 10 minutos
                request.session.set_expiry(600)
                request.session.modified = True
                
                # ============== Enviar correo electronico con código OTP ===============
                send_mail(
                    subject='🔐 Código de Verificación - La Gran Cosecha',

                    message=f'''
                        Hola {user.nombre_usuario},
                        Su código OTP es: {otp_code}
                        Este código expirará en 10 minutos.
                        ''',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email_usuario],
                    fail_silently=False,
                    html_message=f"""
                    <div style="
                        margin:0;
                        padding:50px 20px;
                        background:#edf2f7;
                        font-family:'Segoe UI',Arial,sans-serif;
                    ">

                    ```
                    <div style="
                        max-width:650px;
                        margin:auto;
                        background:#ffffff;
                        border-radius:24px;
                        overflow:hidden;
                        box-shadow:0 20px 60px rgba(0,0,0,.12);
                    ">

                        <!-- BARRA SUPERIOR -->
                        <div style="
                            height:8px;
                            background:linear-gradient(
                                90deg,
                                #198754,
                                #20c997,
                                #0d6efd
                            );
                        "></div>

                        <!-- HEADER -->
                        <div style="
                            background:linear-gradient(
                                135deg,
                                #0f172a,
                                #198754
                            );
                            text-align:center;
                            padding:50px 30px;
                        ">

                            <div style="
                                width:90px;
                                height:90px;
                                margin:auto;
                                border-radius:50%;
                                background:rgba(255,255,255,.12);
                                line-height:90px;
                                font-size:42px;
                                color:white;
                            ">
                                🔒
                            </div>

                            <h1 style="
                                color:white;
                                margin:25px 0 10px;
                                font-size:32px;
                                font-weight:700;
                                letter-spacing:1px;
                            ">
                                La Gran Cosecha
                            </h1>

                            <p style="
                                color:rgba(255,255,255,.85);
                                font-size:15px;
                                margin:0;
                            ">
                                Plataforma Administrativa Segura
                            </p>

                        </div>

                        <!-- CONTENIDO -->
                        <div style="padding:50px 45px;">

                            <div style="
                                display:inline-block;
                                background:#e8fff1;
                                color:#198754;
                                padding:8px 18px;
                                border-radius:50px;
                                font-size:13px;
                                font-weight:600;
                                margin-bottom:25px;
                            ">
                                VERIFICACIÓN DE IDENTIDAD
                            </div>

                            <h2 style="
                                margin-top:0;
                                color:#0f172a;
                                font-size:28px;
                            ">
                                Hola {user.nombre_usuario}
                            </h2>

                            <p style="
                                font-size:16px;
                                color:#4b5563;
                                line-height:1.8;
                            ">
                                Detectamos una solicitud de acceso a su cuenta.
                                Para proteger la información de la organización,
                                confirme su identidad utilizando el siguiente
                                código de verificación:
                            </p>

                            <!-- OTP CARD -->
                            <div style="
                                margin:40px 0;
                                text-align:center;
                            ">

                                <div style="
                                    display:inline-block;
                                    padding:28px 45px;
                                    background:linear-gradient(
                                        135deg,
                                        #198754,
                                        #157347
                                    );
                                    border-radius:20px;
                                    box-shadow:0 12px 35px rgba(25,135,84,.35);
                                ">

                                    <div style="
                                        color:white;
                                        font-size:14px;
                                        letter-spacing:2px;
                                        margin-bottom:10px;
                                    ">
                                        CÓDIGO OTP
                                    </div>

                                    <div style="
                                        color:white;
                                        font-size:44px;
                                        font-weight:800;
                                        letter-spacing:12px;
                                    ">
                                        {otp_code}
                                    </div>

                                </div>

                            </div>

                            <!-- ALERTA -->
                            <div style="
                                background:#fff8e1;
                                border-left:5px solid #ffc107;
                                padding:18px;
                                border-radius:12px;
                                margin-bottom:25px;
                            ">

                                <strong style="color:#856404;">
                                    Importante:
                                </strong>

                                <div style="
                                    margin-top:6px;
                                    color:#856404;
                                    line-height:1.6;
                                ">
                                    Este código expirará en
                                    <strong>10 minutos</strong>.
                                </div>

                            </div>

                            <p style="
                                font-size:15px;
                                color:#6b7280;
                                line-height:1.8;
                            ">
                                Si usted no realizó esta solicitud,
                                puede ignorar este mensaje de forma segura.
                                Ninguna acción adicional será requerida.
                            </p>

                        </div>

                        <!-- FOOTER -->
                        <div style="
                            background:#0f172a;
                            text-align:center;
                            padding:35px 20px;
                        ">

                            <div style="
                                color:white;
                                font-size:16px;
                                font-weight:600;
                                margin-bottom:10px;
                            ">
                                La Gran Cosecha
                            </div>

                            <div style="
                                color:#94a3b8;
                                font-size:13px;
                                line-height:1.8;
                            ">
                                Este correo fue generado automáticamente por el
                                sistema de autenticación segura.
                            </div>

                            <div style="
                                margin-top:15px;
                                color:#64748b;
                                font-size:12px;
                            ">
                                © 2026 La Gran Cosecha Corp. Todos los derechos reservados.
                            </div>

                        </div>

                    </div>
                    ```

                    </div>

                    
                    """
                )
                
                return JsonResponse({
                    'success': True,
                    'step': 2,
                    'message': 'Código OTP enviado correctamente.'
                })
                
            except Exception as e:
                
                print("Error al Enviar el código OTP:", str(e))
                
                return JsonResponse({
                    'success': False,
                    'message': 'Error enviando el código OTP.'
                }, status=500)
    
# --- ÁREA ADMINISTRATIVA (DASHBOARD) ---
@login_required(login_url='login')
def dashboard_view(request):
    """
    VISTA BASE: Carga la estructura (Sidebar, Navbar).
    No calcula estadísticas pesadas, solo identifica al usuario.
    """
    if not request.user.is_staff:
        messages.error(request, "Acceso denegado.")
        return redirect('inicio')

    context = {
        'titulo': 'Panel de Control - La Gran Cosecha',
        'usuario_actual': request.user,
    }
    return render(request, 'ui/pages/Dashboard/ui/Admin-Dashboard.html', context)


@login_required(login_url='login')
def estadisticas_resumen_view(request):
    # 1. Validación de seguridad
    if not request.user.is_staff:
        return redirect('inicio')

    # 2. Configuración de Tiempos
    ahora = timezone.now()
    hace_24_horas = ahora - timedelta(days=1)
    primer_dia_mes_actual = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    primer_dia_mes_anterior = primer_dia_mes_actual - relativedelta(months=1)
    primer_dia_anio_actual = ahora.replace(month=1, day=1, hour=0, minute=0, second=0)

    # --- 3. LÓGICA DE VENTAS (MÉTRICAS) ---
    # Caja de Hoy (Efectivo/Cobrado hoy)
    total_caja_hoy = Pedido.objects.filter(
        fecha_pedido__date=ahora.date(),
        estado='COMPLETADO'
    ).aggregate(total=Sum('total_pedido'))['total'] or 0
    
    # Eficiencia de hoy
    total_pedidos_hoy = Pedido.objects.filter(fecha_pedido__date=ahora.date()).count()
    completados_hoy = Pedido.objects.filter(fecha_pedido__date=ahora.date(), estado='COMPLETADO').count()
    eficiencia = (completados_hoy / total_pedidos_hoy * 100) if total_pedidos_hoy > 0 else 100

    # Ventas Mes Actual
    ventas_raw = Pedido.objects.filter(
        fecha_pedido__gte=primer_dia_mes_actual,
        estado='COMPLETADO'
    ).aggregate(total=Sum('total_pedido'))['total'] or 0

    # Ventas Mes Anterior (para crecimiento)
    ventas_anterior_raw = Pedido.objects.filter(
        fecha_pedido__gte=primer_dia_mes_anterior,
        fecha_pedido__lt=primer_dia_mes_actual,
        estado='COMPLETADO'
    ).aggregate(total=Sum('total_pedido'))['total'] or 0

    # Formateo de Ventas (Ej: 1.5M)
    if ventas_raw >= 1_000_000:
        ventas_mes_label = f"{ventas_raw / 1_000_000:.1f}M"
    elif ventas_raw >= 1_000:
        ventas_mes_label = f"{ventas_raw / 1_000:.1f}K"
    else:
        ventas_mes_label = f"{ventas_raw:.0f}"

    # Crecimiento Mensual
    crecimiento_mensual = 0
    if ventas_anterior_raw > 0:
        crecimiento_mensual = ((ventas_raw - ventas_anterior_raw) / ventas_anterior_raw) * 100

    # --- 4. OTRAS MÉTRICAS DEL GRID ---
    pedidos_pendientes = Pedido.objects.filter(estado__in=['PENDIENTE', 'PROCESANDO']).count()
    
    # Ventas Año Actual (Meta)
    ventas_anio_raw = Pedido.objects.filter(
        fecha_pedido__gte=primer_dia_anio_actual,
        estado='COMPLETADO'
    ).aggregate(total=Sum('total_pedido'))['total'] or 0
    
    meta_anual = 100_000_000 
    progreso_meta = min(int((ventas_anio_raw / meta_anual) * 100), 100) if meta_anual > 0 else 0

    # --- 5. NOTIFICACIONES (CAMPANA) ---
    actividades = [] # INICIALIZACIÓN IMPORTANTE
    
    clientes_recientes = Cliente.objects.filter(fecha_registro_cliente__gte=hace_24_horas)
    pedidos_recientes = Pedido.objects.filter(fecha_pedido__gte=hace_24_horas)
    
    # Llenar actividades de clientes
    for c in clientes_recientes.order_by('-fecha_registro_cliente')[:3]:
        actividades.append({
            'id': f'c_{c.id}',
            'tipo': 'cliente',
            'msj': f"Nuevo cliente: {c.nombre_cliente}",
            'icon': 'bx-user-plus',
            'color': 'text-blue-600',
            'leida': False
        })
        
    # Llenar actividades de pedidos
    for p in pedidos_recientes.order_by('-id')[:3]:
        actividades.append({
            'id': f'p_{p.id}',
            'tipo': 'pedido',
            'msj': f"Pedido #{p.id} recibido",
            'icon': 'bx-cart',
            'color': 'text-emerald-600',
            'leida': False
        })

    # Convertir a JSON después de haber llenado la lista
    actividades_json = json.dumps(actividades)

    # --- 6. DATOS PARA GRÁFICOS (Chart.js) ---
    conteo_categorias = Categoria.objects.annotate(
        num_productos=Count('productos')
    ).order_by('-num_productos')
    
    # Grafico de ventas - ultimos 7 días
    ventas_7dias = (
        Pedido.objects.filter(
            fecha_pedido__gte=ahora - timedelta(days=6),
            estado='COMPLETADO'
        )
        .annotate(dia=TruncDay('fecha_pedido'))
        .values('dia')
        .annotate(total=Sum('total_pedido'))
        .order_by('dia')
    )
    
    dias_labels = []
    ventas_data = []
    
    for i in range(7):
        fecha = (ahora - timedelta(days=6 - i)).date()
        dias_labels.append(fecha.strftime('%d %b'))
        
        total_dia = next(
            (
                item['total']
                for item in ventas_7dias
                if item['dia'].date() == fecha        
            ),
            0
        )
        ventas_data.append(float(total_dia or 0))
    
    # ======= TOP PRODUCTOS - VENTAS
    
    top_productos = (
        Producto.objects
        .annotate(
            total_vendidos=Count('presentaciones__detallepedido')
        )
        .order_by('-total_vendidos')[:5]
    )


    top_productos_labels = []
    top_productos_data = []
    productos_top_dashboard = []

    for producto in top_productos:

        total = producto.total_vendidos or 0

        top_productos_labels.append(
            producto.nombre_producto
        )

        top_productos_data.append(total)

        # Estado visual
        if total >= 100:
            estado = 'Alto'
            color = 'emerald'

        elif total >= 50:
            estado = 'Medio'
            color = 'amber'

        else:
            estado = 'Bajo'
            color = 'red'

        productos_top_dashboard.append({
            'nombre': producto.nombre_producto,
            'cantidad': total,
            'estado': estado,
            'color': color,
        })


    # Fallback
    if not top_productos_labels:

        top_productos_labels = ['Sin datos']
        top_productos_data = [0]

        productos_top_dashboard = [{
            'nombre': 'Sin ventas',
            'cantidad': 0,
            'estado': 'Sin datos',
            'color': 'red',
        }]
            
    # ===== Clientes nuevos por mes ======
    clientes_por_mes = (
        Cliente.objects
        .filter(
            fecha_registro_cliente__gte=primer_dia_mes_actual
        )
        .annotate(
            dia=TruncDay('fecha_registro_cliente')
        )
        .values('dia')
        .annotate(
            total=Count('id')
        )
        .order_by('dia')
    )

    # --- 7. CONTEXTO FINAL ---
    context = {
        'titulo': 'Panel de Control | Resumen',

        # Header
        'total_caja_hoy': total_caja_hoy,
        'eficiencia': round(eficiencia, 1),
        'usuario_actual': request.user,

        # Métricas
        'ventas_mes': ventas_mes_label,
        'crecimiento_mensual': round(crecimiento_mensual, 1),
        'pedidos_pendientes': pedidos_pendientes,
        'total_clientes': Cliente.objects.count(),
        'ventas_anio_actual': f"{ventas_anio_raw / 1_000_000:.1f}M",
        'progreso_meta': progreso_meta,

        # Charts
        'orders_chart_labels': dias_labels,
        'orders_chart_data': ventas_data,

        'top_products_labels': top_productos_labels,
        'top_products_data': top_productos_data,

        'customers_chart_labels': [
            c['dia'].strftime('%d %b')
            for c in clientes_por_mes
        ],

        'customers_chart_data': [
            c['total']
            for c in clientes_por_mes
        ],

        # Totales generales
        'total_productos': Producto.objects.count(),
        'total_usuarios': Usuario.objects.count(),
        'total_categorias': Categoria.objects.count(),

        # Categorías
        'labels_grafico': [
            c.nombre_categoria
            for c in conteo_categorias
        ],

        'valores_grafico': [
            c.num_productos
            for c in conteo_categorias
        ],

        # Notificaciones
        'actividades_recientes': actividades,
        'actividades_recientes_js': actividades_json,
        'num_notificaciones': len([
            a for a in actividades if not a['leida']
        ]),

        # Tabla
        'ultimos_pedidos': Pedido.objects.select_related('cliente')
        .annotate(num_items=Count('detalles'))
        .order_by('-id')[:5],
    }

    return render(request, 'ui/pages/Dashboard/ui/dashboard.html', context)

import logging

logger = logging.getLogger(__name__)


@login_required
def gestion_catalogo(request):

    total_productos = Producto.objects.count()
    activos = Producto.objects.filter(estado_producto=True).count()
    inactivos = Producto.objects.filter(estado_producto=False).count()
    categorias = Categoria.objects.filter(estado_categoria=True).count()

    # =========================================================
    # POST → CREAR / EDITAR PRODUCTOS
    # =========================================================
    if request.method == 'POST':
        try:
            with transaction.atomic():
                producto_id = request.POST.get('producto_id')

                # =====================================================
                # DATOS DEL PRODUCTO
                #
                # FIX 1: se retira 'imagen' de este diccionario.
                # El form de edición/creación NUNCA envía un campo
                # 'imagen' (la imagen se sube por su propio endpoint,
                # subir_imagen_producto, con request.FILES). Al hacer
                # request.POST.get('imagen') aquí siempre devolvía
                # None, y el setattr() de abajo pisaba y borraba la
                # imagen ya guardada en cada edición de nombre/precio/etc.
                # =====================================================

                datos_producto = {
                    'nombre_producto': request.POST.get('nombre_producto'),
                    'categoria_id': request.POST.get('categoria'),
                    'unidad_base_id': request.POST.get('unidad_base'),
                    'tipo_cantidad': request.POST.get('tipo_cantidad'),
                    'permite_fraccion': request.POST.get('permite_fraccion') in ['on', 'true', True],
                    'estado_producto': request.POST.get('estado_producto') in ['on', 'true', True],
                }

                # =====================================================
                # CREAR / EDITAR PRODUCTO
                # =====================================================

                if producto_id:

                    producto = get_object_or_404(Producto, id=producto_id)

                    for key, value in datos_producto.items():
                        setattr(producto, key, value)

                    producto.save()

                    msg = f"{producto.nombre_producto} actualizado correctamente"

                else:

                    producto = Producto.objects.create(**datos_producto)

                    msg = f"{producto.nombre_producto} creado correctamente"

                # =====================================================
                # DATOS PRESENTACIONES
                # =====================================================

                pres_ids = request.POST.getlist('pres_id[]')
                nombres_pres = request.POST.getlist('pres_nombre[]')
                unidades_pres = request.POST.getlist('pres_unidad[]')
                factores_pres = request.POST.getlist('pres_factor[]')
                precios_pres = request.POST.getlist('pres_precio[]')

                ids_recibidos = []

                for pres_id, nombre, unidad_id, factor, precio in zip(
                    pres_ids, nombres_pres, unidades_pres, factores_pres, precios_pres
                ):

                    nombre = nombre.strip()

                    if not nombre:
                        continue

                    try:
                        factor = Decimal(factor or 1)
                        precio = Decimal(precio or 0)
                    except InvalidOperation:
                        logger.warning(
                            "Factor/precio inválido para presentación '%s' del producto %s",
                            nombre, producto.id
                        )
                        continue

                    if pres_id:

                        presentacion = get_object_or_404(
                            PresentacionProducto, id=pres_id, producto=producto
                        )

                        if presentacion.precio_unitario != precio:
                            HistorialPrecio.objects.create(
                                presentacion=presentacion,
                                precio_anterior=presentacion.precio_unitario,
                                precio_nuevo=precio,
                                usuario=request.user,
                            )

                        presentacion.nombre_presentacion = nombre
                        presentacion.unidad_venta_id = unidad_id
                        presentacion.factor_conversion = factor
                        presentacion.precio_unitario = precio
                        presentacion.estado_presentacion = True
                        presentacion.save()

                        ids_recibidos.append(presentacion.id)

                    else:

                        nueva_presentacion = PresentacionProducto.objects.create(
                            producto=producto,
                            nombre_presentacion=nombre,
                            unidad_venta_id=unidad_id,
                            factor_conversion=factor,
                            precio_unitario=precio,
                            estado_presentacion=True,
                        )

                        ids_recibidos.append(nueva_presentacion.id)

                # =====================================================
                # DESACTIVAR PRESENTACIONES ELIMINADAS
                #
                # FIX 2: se quita el "if ids_recibidos:". Si el usuario
                # borró TODAS las filas del modal (caso límite pero
                # posible), ids_recibidos queda [] y el if antiguo
                # evitaba que se ejecutara el update, dejando presentaciones
                # viejas activas como si nada hubiera cambiado.
                # exclude(id__in=[]) simplemente actualiza todas, que es
                # el comportamiento correcto en ese caso.
                # =====================================================

                producto.presentaciones.exclude(
                    id__in=ids_recibidos
                ).update(estado_presentacion=False)

                messages.success(request, msg)
                return redirect('gestion_catalogo')

        except Exception as e:
            # FIX 3: ya no se expone str(e) al usuario final (podía
            # filtrar detalles internos/traceback). Se loguea completo
            # para debug y se muestra un mensaje genérico.
            logger.exception("Error guardando producto en gestion_catalogo")
            messages.error(
                request,
                "No se pudo guardar el producto. Verifica los datos e intenta de nuevo."
            )
            return redirect('gestion_catalogo')

    # =========================================================
    # GET → CONSULTA DE PRODUCTOS
    #
    # FIX 4: se amplía el prefetch_related para traer también
    # unidad_venta e historial_precios de cada presentación en las
    # mismas queries iniciales. Antes, el template disparaba una
    # query nueva por cada .exists(), .first() y .all() sobre
    # historial_precios de CADA presentación de CADA producto listado
    # (N+1). Con 20 productos x 3 presentaciones eso son decenas de
    # queries extra por página.
    # =========================================================

    product_list = Producto.objects.select_related(
        'categoria', 'unidad_base'
    ).prefetch_related(
        'presentaciones__unidad_venta',
        'presentaciones__historial_precios',
    ).order_by('-id')

    query = request.GET.get('q', '')
    cat_id = request.GET.get('cat', '')
    estado = request.GET.get('estado', 'activos')

    if query:
        product_list = product_list.filter(
            Q(nombre_producto__icontains=query) |
            Q(categoria__nombre_categoria__icontains=query)
        ).distinct()

    if cat_id:
        product_list = product_list.filter(categoria_id=cat_id)

    if estado == 'activos':
        product_list = product_list.filter(estado_producto=True)
    elif estado == 'inactivos':
        product_list = product_list.filter(estado_producto=False)

    paginator = Paginator(product_list, 20)
    page_number = request.GET.get('page')
    productos_paginados = paginator.get_page(page_number)

    context = {
        'productos_activos': productos_paginados,
        'category': Categoria.objects.all(),
        'unidades': UnidadMedida.objects.all(),
        'query': query,
        'cat_id': cat_id,
        'estado_actual': estado,
        'total_productos': total_productos,
        'activos': activos,
        'inactivos': inactivos,
        'categorias': categorias,
        'usuario_actual': request.user,
    }

    return render(request, "ui/pages/Dashboard/ui/catalogo.html", context)


@login_required
@require_POST
def subir_imagen_producto(request, producto_id):
    producto = get_object_or_404(Producto, id=producto_id)

    imagen = request.FILES.get('imagen')

    if imagen:
        # FIX 5: validación básica de tipo y tamaño antes de guardar.
        # Evita que suban archivos que no son imágenes o pesos
        # excesivos que después revientan el listado del catálogo.
        tipos_validos = ('image/jpeg', 'image/png', 'image/webp')
        limite_mb = 5

        if imagen.content_type not in tipos_validos:
            messages.error(request, "Formato de imagen no permitido. Usa JPG, PNG o WEBP.")
            return redirect(request.META.get('HTTP_REFERER', 'gestion_catalogo'))

        if imagen.size > limite_mb * 1024 * 1024:
            messages.error(request, f"La imagen supera el límite de {limite_mb}MB.")
            return redirect(request.META.get('HTTP_REFERER', 'gestion_catalogo'))

        producto.imagen = imagen
        producto.save()
        messages.success(request, "Imagen actualizada correctamente")

    return redirect(request.META.get('HTTP_REFERER', 'gestion_catalogo'))


# =========================================================
# NUEVOS ENDPOINTS: bajas lógicas
#
# El template ya tenía botones "Eliminar Producto completo" y
# "Eliminar presentación" sin ningún handler ni endpoint detrás
# (eliminarProducto() no existía en el x-data de Alpine). Como no
# manejas stock y sí historial de precios, lo correcto es baja
# lógica (estado_producto / estado_presentacion = False), nunca
# borrado físico, para no perder trazabilidad del historial.
# =========================================================

@login_required
@require_POST
def eliminar_producto(request, producto_id):
    producto = get_object_or_404(Producto, id=producto_id)
    producto.estado_producto = False
    producto.save()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'ok': True, 'mensaje': f"{producto.nombre_producto} desactivado"})

    messages.success(request, f"{producto.nombre_producto} desactivado del catálogo")
    return redirect('gestion_catalogo')


@login_required
@require_POST
def eliminar_presentacion(request, presentacion_id):
    presentacion = get_object_or_404(PresentacionProducto, id=presentacion_id)
    presentacion.estado_presentacion = False
    presentacion.save()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'ok': True})

    messages.success(request, "Presentación eliminada")
    return redirect('gestion_catalogo')
        

@login_required
@require_POST
def editar_pedido_view(request, pedido_id):
 
    if not request.user.is_staff:
        return JsonResponse({'message': 'No autorizado'}, status=403)
 
    pedido = get_object_or_404(Pedido, id=pedido_id)
 
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'message': 'Payload inválido'}, status=400)
 
    detalles_payload = payload.get('detalles', [])
    observaciones = payload.get('observaciones', '')
 
    if not detalles_payload:
        return JsonResponse(
            {'message': 'El pedido debe tener al menos un producto'}, status=400
        )
 
    try:
        with transaction.atomic():
            ids_recibidos = []
            nuevo_total = Decimal('0')
 
            for item in detalles_payload:
 
                detalle_id = item.get('detalle_id')
 
                # Sin detalle_id no sabemos a qué línea corresponde;
                # este modal solo edita/elimina líneas existentes, no
                # permite agregar productos nuevos.
                if not detalle_id:
                    continue
 
                try:
                    cantidad = Decimal(str(item.get('cantidad', 0)))
                    precio_unitario = Decimal(str(item.get('precio_unitario', 0)))
                except InvalidOperation:
                    return JsonResponse(
                        {'message': 'Cantidad o precio inválido en uno de los productos'},
                        status=400
                    )
 
                if cantidad <= 0:
                    return JsonResponse(
                        {'message': 'La cantidad debe ser mayor a 0'}, status=400
                    )
 
                if precio_unitario < 0:
                    return JsonResponse(
                        {'message': 'El precio no puede ser negativo'}, status=400
                    )
 
                subtotal = (cantidad * precio_unitario).quantize(Decimal('0.01'))
 
                detalle = get_object_or_404(
                    DetallePedido, id=detalle_id, pedido=pedido
                )
 
                detalle.cantidad = cantidad
                detalle.precio_unitario = precio_unitario
                detalle.subtotal = subtotal
 
                if detalle.presentacion is None:
                    nuevo_nombre = (item.get('nombre_producto') or '').strip()
                    if nuevo_nombre:
                        detalle.nombre_personalizado = nuevo_nombre
 
                detalle.save()
 
                ids_recibidos.append(detalle.id)
                nuevo_total += subtotal
 
            # Elimina del pedido las líneas que el usuario quitó en el modal
            pedido.detalles.exclude(id__in=ids_recibidos).delete()
 
            pedido.total_pedido = nuevo_total
 
            if hasattr(pedido, 'observaciones'):
                pedido.observaciones = observaciones
 
            pedido.save()
 
        return JsonResponse({'success': True, 'total': float(nuevo_total)})
 
    except DetallePedido.DoesNotExist:
        return JsonResponse(
            {'message': 'Uno de los productos no pertenece a este pedido'}, status=404
        )
    except Exception:
        logger.exception("Error editando pedido %s", pedido_id)
        return JsonResponse(
            {'message': 'No se pudo guardar el pedido, intenta de nuevo'}, status=500
        )
        
@login_required
@require_POST
def entregar_pedidos_view(request):
 
    if not request.user.is_staff:
        return JsonResponse({'message': 'No autorizado'}, status=403)
 
    try:
        payload = json.loads(request.body)
        ids = payload.get('ids', [])
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'message': 'Payload inválido'}, status=400)
 
    ids = [i for i in ids if str(i).isdigit()]
 
    if not ids:
        return JsonResponse({'message': 'No se seleccionaron pedidos'}, status=400)
 
    actualizados = Pedido.objects.filter(id__in=ids).update(estado='ENTREGADO')
 
    return JsonResponse({'success': True, 'actualizados': actualizados})
        
def gestion_clientes(request):
    if not request.user.is_staff:
        return redirect('inicio')
    
    client_list = Cliente.objects.all()
    query = request.GET.get('q')
    
    if query:
        client_list = client_list.filter(
            Q(nombre_cliente__icontains=query) |
            Q(telefono_cliente__icontains=query) |
            Q(fecha_registro_cliente__icontains=query)
        )

    context = {
        'clientes': client_list,
        'usuario_actual': request.user
    }

    return render(request, 'ui/pages/Dashboard/ui/clientes.html', context)

def es_administrador(user):
    return user.is_authenticated and (user.rol_usuario == 'GERENTE' or user.is_superuser)

@user_passes_test(es_administrador)
def gestion_usuarios(request):
    usuarios = Usuario.objects.all()
    # Obtenemos todas las sesiones que no han expirado
    sessions = Session.objects.filter(expire_date__gte=timezone.now())
    sesiones_activas = []

    for session in sessions:
        data = session.get_decoded()
        # El ID del usuario suele guardarse en '_auth_user_id'
        user_id = data.get('_auth_user_id')
        
        # Opcional: Si quieres filtrar sesiones solo del usuario que estás viendo,
        # esto podrías hacerlo vía AJAX, pero aquí traemos todas para el ejemplo.
        if user_id:
            sesiones_activas.append({
                'session_key': session.session_key,
                'user_id': user_id,
                'ip': data.get('ip', 'Desconocida'), # Requiere middleware para guardar IP
                'last_activity': session.expire_date,
                'device': data.get('device', 'Web Browser')
            })

    return render(request, 'ui/pages/Dashboard/ui/usuarios.html', {
        'usuarios': usuarios,
        'sesiones_activas': sesiones_activas,
        'usuario_actual': request.user
        # ... otros contextos
    })

def cerrar_sesion_remota(request):
    if request.method == 'POST':
        session_key = request.POST.get('session_key')
        try:
            s = Session.objects.get(session_key=session_key)
            s.delete()
            messages.success(request, "La sesión ha sido finalizada correctamente.")
        except Session.DoesNotExist:
            messages.error(request, "La sesión ya no existe.")
            
    return redirect('gestion_usuarios')

def generar_password_seguro(longitud=12):
    caracteres = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(caracteres) for _ in range(longitud))

@login_required
@require_POST
def crear_usuario(request):
    try:
        data = json.loads(request.body)
        
        email = data.get("email", "").strip()
        nombre = data.get("nombre", "").strip()
        rol = data.get("rol", "ANALISTA")
        is_estaff = True,
        
        
        # 1. Validaciones
        if not email or not nombre:
            return JsonResponse({
                "success": False, 
                "message": "El correo y el nombre completo son obligatorios."
            }, status=400)

        if Usuario.objects.filter(email_usuario__iexact=email).exists():
            return JsonResponse({
                "success": False, 
                "message": "Ya existe una cuenta registrada con este correo."
            }, status=400)

        # 2. Clave temporal segura
        password_temp = generar_password_seguro()

        # 3. Crear usuario llamando a TU Manager con las variables exactas
        nuevo_usuario = Usuario.objects.create_user(
            email_usuario=email,
            nombre_usuario=nombre,
            password=password_temp,
            rol_usuario=rol
        )

        return JsonResponse({
            "success": True,
            "message": f"Usuario creado. Clave temporal asignada: {password_temp}",
            "usuario": {
                "id": nuevo_usuario.id,
                "nombre": nuevo_usuario.nombre_usuario,
                "email": nuevo_usuario.email_usuario,
                "rol": nuevo_usuario.rol_usuario
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "JSON malformado recibido."}, status=400)
    except Exception as e:
        # Imprime el traceback exacto en la consola de Django/Terminal
        import traceback
        print("=== ERROR AL CREAR USUARIO ===")
        traceback.print_exc()
        
        # Devuelve el mensaje exacto al frontend para depurar
        return JsonResponse({
            "success": False, 
            "message": f"Error interno en el servidor: {str(e)}"
        }, status=500)

@login_required(login_url='login')
def gestion_pedidos_view(request):
    if not request.user.is_staff:
        return redirect('inicio')

    # Capturar búsqueda
    query = request.GET.get('q', '')

    # Obtener la fecha actual respetando la zona horaria de Django (settings.TIME_ZONE)
    hoy = timezone.now().date()

    # --- 1. OPERACIÓN DE HOY ---
    # Traemos solo los pedidos que coincidan con la fecha de hoy
    pedidos_hoy = Pedido.objects.select_related('cliente').filter(
        fecha_pedido__date=hoy
    ).order_by('-id')
    
    # Calculamos el total de dinero solo de hoy
    total_dinero_hoy = pedidos_hoy.aggregate(Sum('total_pedido'))['total_pedido__sum'] or 0

    # --- 2. HISTORIAL COMPLETO ---
    pedidos = Pedido.objects.select_related('cliente').order_by('-id')

    # Si hay búsqueda, la aplicamos al historial
    if query:
        pedidos = pedidos.filter(
            Q(id__icontains=query) |
            Q(cliente__nombre_cliente__icontains=query)
        )

    # --- 3. MINI ESTADÍSTICAS (Basadas en el historial/búsqueda) ---
    total_pedidos = pedidos.count()
    pendientes = pedidos.filter(estado="PENDIENTE").count()
    dinero_total = pedidos.aggregate(Sum('total_pedido'))['total_pedido__sum'] or 0

    context = {
        'pedidos': pedidos,                 # Tabla de historial
        'pedidos_hoy': pedidos_hoy,         # Tabla de operación de hoy
        'total_pedidos': total_pedidos,     # Tarjeta resumen
        'total_pendientes': pendientes,     # Tarjeta resumen
        'total_dinero': dinero_total,       # Tarjeta resumen
        'total_dinero_hoy': total_dinero_hoy, # Pie de tabla de hoy
        'query': query,
        'usuario_actual': request.user,
    }

    return render(request, 'ui/pages/Dashboard/ui/gestion_pedidos.html', context)



logger = logging.getLogger(__name__)
 
 
@login_required
def detalle_pedido_api(request, pedido_id):
    """
    Igual a tu versión original, con dos ajustes:
    - print() -> logger.exception(): antes el error solo aparecía en la
      consola del servidor de desarrollo; con logging queda registrado
      de forma consistente en producción también.
    - Ya no se devuelve str(e) crudo al cliente (podía filtrar detalles
      internos como nombres de tablas/columnas).
    """
 
    if not request.user.is_staff:
        return JsonResponse({'error': 'No autorizado'}, status=403)
 
    try:
        pedido = Pedido.objects.select_related('cliente').get(id=pedido_id)
 
        detalles = pedido.detalles.select_related(
            'presentacion__producto',
            'presentacion__unidad_venta',
            'categoria_manual',
            'unidad_personalizada',
        )
 
        data_detalles = []
 
        for d in detalles:
            if d.presentacion:
                nombre_producto = d.presentacion.producto.nombre_producto
                presentacion_id = d.presentacion.id
                categoria = (
                    d.presentacion.producto.categoria.nombre_categoria
                    if d.presentacion.producto.categoria else ''
                )
            else:
                nombre_producto = d.nombre_personalizado
                presentacion_id = None
                categoria = (
                    d.categoria_manual.nombre_categoria
                    if d.categoria_manual else ''
                )
 
            data_detalles.append({
                'id': d.id,
                'detalle_id': d.id,
                'presentacion_id': presentacion_id,
                'nombre_producto': nombre_producto,
                'categoria': categoria,
                'cantidad': float(d.cantidad or 0),
                'precio_unitario': float(d.precio_unitario or 0),
                'subtotal': float(d.subtotal or 0),
                'personalizado': d.presentacion is None,
            })
 
        return JsonResponse({
            'cliente': pedido.cliente.nombre_cliente if pedido.cliente else '',
            'observaciones': getattr(pedido, 'observaciones', ''),
            'detalles': data_detalles,
        })
 
    except Pedido.DoesNotExist:
        return JsonResponse({'error': 'Pedido no encontrado'}, status=404)
    except Exception:
        logger.exception("Error obteniendo detalle del pedido %s", pedido_id)
        return JsonResponse({'error': 'No se pudo cargar el pedido'}, status=500)
 

@login_required
@require_POST
def eliminar_pedido_view(request, pedido_id):

    try:
        pedido = Pedido.objects.get(id=pedido_id)
        pedido.delete()

        return JsonResponse({
            'success': True
        })

    except Pedido.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Pedido no encontrado'
        }, status=404)
        
        
@login_required
@require_POST
def eliminar_clientes_view(request, cliente_id):
    try:
        cliente = get_object_or_404(Cliente, id=cliente_id)
        cliente.delete()

        return JsonResponse({
            "success": True,
            "message": "Cliente eliminado correctamente"
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@login_required
@require_POST
def eliminar_usuarios(request, usuario_id):
    try:
        usuarios= get_object_or_404(Usuario, id=usuario_id)
        usuarios.delete()
        return JsonResponse({
            "success": True,
            "message":"Usuario eliminado correctamente"
        })
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        },status=500)
        
def generar_pedido(request):
    if request.method == "POST":
        nombre_cliente = request.POST.get('cliente_nombre')
        
        if not nombre_cliente:
            return JsonResponse({
                'status': 'error', 
                'message': 'Por favor, escribe tu nombre o el de tu negocio.'
            }, status=400)
        print("\n========== POST ==========")

        for k, v in request.POST.lists():
            print(k, "=>", v)

        print("==========================")

        try:
            with transaction.atomic():
                # 1. Gestión del Cliente (Público)
                cliente, _ = Cliente.objects.get_or_create(
                    nombre_cliente=nombre_cliente.strip()
                )

                # 2. Crear el pedido (Sin requerir usuario autenticado)
                pedido = Pedido.objects.create(
                    cliente=cliente,
                    # Si tu modelo permite null en usuario, esto funcionará:
                    usuario=request.user if request.user.is_authenticated else None,
                    estado="PENDIENTE"
                )

                productos_agregados = 0

                # 3. Procesar Productos
                for key, value in request.POST.items():
                    if key.startswith('prod_') and key.endswith('_cantidad'):
                        prod_id = key.split('_')[1]
                        cantidad_decimal = convertir_texto_a_decimal(value)

                        if cantidad_decimal > 0:
                            pres_id = request.POST.get(f'prod_{prod_id}_presentacion')
                            if pres_id:
                                presentacion = PresentacionProducto.objects.get(id=pres_id)
                                DetallePedido.objects.create(
                                    pedido=pedido,
                                    presentacion=presentacion,
                                    cantidad=cantidad_decimal,
                                    precio_unitario=presentacion.precio_unitario
                                )
                                productos_agregados += 1
                # ==================================================
                # PRODUCTOS PERSONALIZADOS
                # ==================================================

                for key in request.POST.keys():

                    if not key.startswith('custom_nombre_'):
                        continue

                    sufijo = key.replace(
                        'custom_nombre_',
                        ''
                    ).replace('[]', '')

                    try:
                        categoria = Categoria.objects.get(
                            id=sufijo
                        )
                    except Categoria.DoesNotExist:
                        categoria = None

                    nombres = request.POST.getlist(
                        f'custom_nombre_{sufijo}[]'
                    )

                    cantidades = request.POST.getlist(
                        f'custom_cant_{sufijo}[]'
                    )

                    unidades = request.POST.getlist(
                        f'custom_uni_{sufijo}[]'
                    )

                    tipos = request.POST.getlist(
                        f'item_type_{sufijo}[]'
                    )

                    catalog_products = request.POST.getlist(
                        f'catalog_product_id_{sufijo}[]'
                    )

                    catalog_presentations = request.POST.getlist(
                        f'catalog_presentation_id_{sufijo}[]'
                    )

                    for i, nombre in enumerate(nombres):

                        nombre = nombre.strip()

                        if not nombre:
                            continue

                        cantidad = convertir_texto_a_decimal(
                            cantidades[i]
                        )

                        if cantidad <= 0:
                            continue

                        tipo = (
                            tipos[i]
                            if i < len(tipos)
                            else 'manual'
                        )

                        # ==========================
                        # PRODUCTO CATÁLOGO SUGERIDO
                        # ==========================

                        if (
                            tipo == 'catalogo'
                            and i < len(catalog_presentations)
                            and catalog_presentations[i]
                        ):

                            presentacion = (
                                PresentacionProducto.objects.get(
                                    id=catalog_presentations[i]
                                )
                            )
                            unidad_id = (
                                unidades[i]
                                if i < len(unidades)
                                and unidades[i]
                                else None
                            )

                            DetallePedido.objects.create(
                                pedido=pedido,
                                presentacion=presentacion,
                                cantidad=cantidad,
                                precio_unitario=presentacion.precio_unitario,
                                categoria_manual=categoria
                            )

                            productos_agregados += 1

                        # ==========================
                        # PRODUCTO MANUAL
                        # ==========================
                        else:
                            DetallePedido.objects.create(
                                pedido=pedido,
                                nombre_personalizado=nombre,
                                categoria_manual=categoria,
                                presentacion=None,
                                cantidad=cantidad,
                                precio_unitario=0
                            )
                            productos_agregados += 1
                if productos_agregados == 0:
                    raise Exception("Tu canasta está vacía. Selecciona al menos un producto.")
                return JsonResponse({
                    'status': 'success',
                    'message': f'¡Gracias {cliente.nombre_cliente}! Tu pedido #{pedido.id} ha sido recibido.',
                })

        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    categorias = Categoria.objects.prefetch_related(
        Prefetch(
            'productos',
            queryset=Producto.objects.filter(
                estado_producto=True
            ).prefetch_related(
                'presentaciones__unidad_venta'
            )
        )
    ).all()
    for categoria in categorias:
        for producto in categoria.productos.all():
            grouped = {}
            for pres in producto.presentaciones.all():
                nombre_pres = pres.nombre_presentacion or 'GENERAL'
                if nombre_pres not in grouped:
                    grouped[nombre_pres] = []
                grouped[nombre_pres].append({
                    'id': pres.id,

                    'unidad': (
                        pres.unidad_venta.nombre_unidad
                        if pres.unidad_venta else ''
                    ),

                    'precio': str(
                        pres.precio_unitario
                    ),

                })

            producto.presentaciones_grouped = list(
                grouped.items()
            )
            producto.presentaciones_json = json.dumps([
                {
                    'nombre': nombre,
                    'variantes': variantes
                }
                for nombre, variantes in grouped.items()
            ])
        unidades = UnidadMedida.objects.filter(
            estado_unidad=True
        )
    return render(
        request,
        'ui/pages/hacer_pedido.html',
        {
            'categorias': categorias,
            'unidades_db': unidades
        }
    )

def convertir_texto_a_decimal(texto):
    mapa = {
        '0': 0,
        '1/4': 0.25,
        '1/2': 0.5,
        '3/4': 0.75
    }
    if texto in mapa:
        return mapa[texto]
    try:
        return float(texto)
    except ValueError:
        return 0

@login_required
@require_GET
def api_preparar_impresion(request):
 
    if not request.user.is_staff:
        return JsonResponse({'error': 'No autorizado'}, status=403)
 
    ids_param = request.GET.get('ids', '')
    ids = [i for i in ids_param.split(',') if i.strip().isdigit()]
 
    if not ids:
        return JsonResponse({'pedidos': []})
 
    pedidos_qs = Pedido.objects.select_related('cliente').filter(
        id__in=ids
    ).prefetch_related(
        'detalles__presentacion__producto',
        'detalles__presentacion__unidad_venta',
        'detalles__categoria_manual',
    )
 
    data = []
 
    for pedido in pedidos_qs:
        detalles = []
 
        for d in pedido.detalles.all():
 
            if d.presentacion:
                nombre = d.presentacion.producto.nombre_producto
                pres_nombre = d.presentacion.nombre_presentacion
                categoria = (
                    d.presentacion.producto.categoria.nombre_categoria
                    if d.presentacion.producto.categoria else ''
                )
            else:
                nombre = d.nombre_personalizado
                pres_nombre = getattr(d, 'unidad_personalizada', '') or ''
                categoria = (
                    d.categoria_manual.nombre_categoria
                    if d.categoria_manual else 'Otros'
                )
 
            detalles.append({
                'producto': nombre,
                'pres': pres_nombre,
                'categoria': categoria,
                'cant': float(d.cantidad or 0),
                'subtotal': float(d.subtotal or 0),
            })
 
        data.append({
            'id': pedido.id,
            'fecha': pedido.fecha_pedido.strftime('%d/%m/%Y %H:%M'),
            'cliente': pedido.cliente.nombre_cliente if pedido.cliente else '',
            'detalles': detalles,
            'total': float(pedido.total_pedido or 0),
        })
 
    # Respeta el orden en que el usuario seleccionó los pedidos
    orden = {int(i): idx for idx, i in enumerate(ids)}
    data.sort(key=lambda p: orden.get(p['id'], 0))
 
    return JsonResponse({'pedidos': data})

def biblioteca(request):
   return render(
        request,
        'ui/pages/Dashboard/ui/Biblioteca-multimedia.html',
   )
     
