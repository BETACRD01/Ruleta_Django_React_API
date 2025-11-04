# backend/notifications/management/commands/check_emails.py
from django.core.management.base import BaseCommand
from django.core.cache import cache
from notifications.tasks import check_emails_periodically, get_email_stats

class Command(BaseCommand):
    help = 'Revisa correos electrónicos y muestra estadísticas'

    def add_arguments(self, parser):
        parser.add_argument(
            '--run',
            action='store_true',
            help='Ejecuta la revisión de correos inmediatamente',
        )
        parser.add_argument(
            '--stats',
            action='store_true',
            help='Muestra estadísticas de correos procesados',
        )

    def handle(self, *args, **options):
        if options['run']:
            self.stdout.write(self.style.SUCCESS('🔍 Revisando correos...'))
            result = check_emails_periodically.apply()
            
            if result.successful():
                data = result.result
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Revisión completada: {data["emails_processed"]} correos procesados'
                    )
                )
                for email in data.get('emails', []):
                    self.stdout.write(f'  📧 De: {email["from"]}')
                    self.stdout.write(f'     Asunto: {email["subject"]}\n')
            else:
                self.stdout.write(self.style.ERROR('❌ Error al revisar correos'))
        
        elif options['stats']:
            self.stdout.write(self.style.SUCCESS('📊 Estadísticas de correos:'))
            result = get_email_stats.apply()
            
            if result.successful():
                stats = result.result
                if stats['status'] == 'no_data':
                    self.stdout.write(self.style.WARNING('⚠️  No hay datos disponibles'))
                else:
                    last_check = stats['last_check']
                    self.stdout.write(
                        f'  Última revisión: {last_check["timestamp"]}'
                    )
                    self.stdout.write(
                        f'  Correos procesados: {last_check["emails_processed"]}'
                    )
            else:
                self.stdout.write(self.style.ERROR('❌ Error obteniendo estadísticas'))
        
        else:
            # Mostrar información general
            self.stdout.write(self.style.SUCCESS('📬 Sistema de revisión de correos'))
            self.stdout.write('\nOpciones disponibles:')
            self.stdout.write('  --run    : Ejecuta revisión inmediata')
            self.stdout.write('  --stats  : Muestra estadísticas')
            self.stdout.write('\nEjemplo de uso:')
            self.stdout.write('  python manage.py check_emails --run')