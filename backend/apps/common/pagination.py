from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Paginación por defecto con tamaño de página ajustable vía ?page_size=."""

    page_size = 20
    page_size_query_param = "page_size"
    # El panel pide páginas de hasta 200 productos, y los selectores de
    # producto/cliente cargan el catálogo entero de una vez; con el tope
    # anterior de 100 esas listas se truncaban en silencio.
    max_page_size = 500
