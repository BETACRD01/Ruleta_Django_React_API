from django.core.management.base import BaseCommand
from authentication.models import UserProfile

class Command(BaseCommand):
    help = 'Asigna teléfonos temporales a usuarios sin teléfono'

    def handle(self, *args, **options):
        # Buscar perfiles sin teléfono o con teléfono vacío
        profiles_sin_telefono = UserProfile.objects.filter(
            phone__isnull=True
        ) | UserProfile.objects.filter(phone='')
        
        count = profiles_sin_telefono.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Todos los usuarios ya tienen teléfono'))
            return
        
        self.stdout.write(f'Encontrados {count} usuarios sin teléfono:')
        
        # Asignar teléfonos temporales únicos
        for i, profile in enumerate(profiles_sin_telefono, start=1):
            temp_phone = f"+593900{str(i).zfill(6)}"
            profile.phone = temp_phone
            profile.save()
            self.stdout.write(f'  {profile.user.email}: {temp_phone}')
        
        self.stdout.write(self.style.SUCCESS(f'\n{count} telefonos temporales asignados'))
        self.stdout.write(self.style.WARNING('Los usuarios deben actualizar sus telefonos reales'))