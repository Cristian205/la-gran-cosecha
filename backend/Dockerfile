# Imagen del backend Django + DRF (pensada para Render, runtime Docker).
#
# Se usa Docker y no el runtime nativo de Python de Render porque WeasyPrint
# (facturas PDF) necesita librerias de sistema — Pango, Cairo, gdk-pixbuf — que
# el runtime nativo no permite instalar.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8000

# Dependencias de sistema necesarias para psycopg2 y weasyprint
RUN apt-get update && apt-get install -y libglib2.0-0 \
        build-essential \
        libpq-dev \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-2.0-0 \
        libffi-dev \
        libcairo2 \
        shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# collectstatic se ejecuta en el BUILD, no en cada arranque: no toca la base de
# datos y su resultado es identico en cada contenedor. Las variables de aqui son
# solo para que los settings de produccion importen; no acaban en la imagen final
# como configuracion real, se sobreescriben en tiempo de ejecucion.
RUN DJANGO_SECRET_KEY=solo-para-el-build \
    DATABASE_URL=postgres://u:p@localhost:5432/db \
    python manage.py collectstatic --noinput

EXPOSE 8000

# Render inyecta PORT; hay que escucharlo o el servicio se marca como caido.
# --timeout 120 porque generar facturas PDF con WeasyPrint puede pasar de 30s.
# exec: gunicorn hereda el PID 1 y recibe el SIGTERM de Render al reiniciar.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 120 --access-logfile - --error-logfile -"]
