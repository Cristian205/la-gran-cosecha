from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Paginación por defecto con tamaño de página ajustable vía ?page_size=."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
