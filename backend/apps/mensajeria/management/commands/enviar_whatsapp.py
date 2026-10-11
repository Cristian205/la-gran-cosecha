"""
Envía los WhatsApp pendientes: los que no salieron al momento (Meta caído,
proceso reiniciado) y los reprogramados tras un fallo pasajero.

    python manage.py enviar_whatsapp            una pasada (para un cron cada minuto)
    python manage.py enviar_whatsapp --bucle    sin parar (para un worker)
"""
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.mensajeria.servicio import procesar_pendientes


class Command(BaseCommand):
    help = "Envía los mensajes de WhatsApp pendientes."

    def add_arguments(self, parser):
        parser.add_argument("--bucle", action="store_true", help="Repetir indefinidamente.")
        parser.add_argument("--intervalo", type=int, default=20, help="Segundos entre pasadas con --bucle.")
        parser.add_argument("--limite", type=int, default=50, help="Máximo de mensajes por pasada.")

    def handle(self, *args, bucle, intervalo, limite, **opciones):
        while True:
            enviados = procesar_pendientes(limite=limite)
            if enviados or not bucle:
                self.stdout.write(f"WhatsApp: {enviados} enviado(s).")
            if not bucle:
                return
            close_old_connections()
            time.sleep(intervalo)
