# authentication/adapters.py
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Adapter personalizado para manejar el registro social
    """
    
    def pre_social_login(self, request, sociallogin):
        """
        Invocado justo después de que un usuario se autentica con éxito vía proveedor social
        """
        # Si el usuario ya existe, conectar la cuenta social
        if sociallogin.is_existing:
            return
        
        # Si es un nuevo usuario
        if not sociallogin.user.id:
            try:
                # Intentar encontrar usuario existente con el mismo email
                email = sociallogin.account.extra_data.get('email', '').lower()
                if email:
                    from authentication.models import User
                    user = User.objects.filter(email__iexact=email).first()
                    
                    if user:
                        # Conectar cuenta social al usuario existente
                        sociallogin.connect(request, user)
                        logger.info(f"Cuenta social conectada a usuario existente: {email}")
            except Exception as e:
                logger.error(f"Error conectando cuenta social: {e}")
    
    def populate_user(self, request, sociallogin, data):
        """
        Personaliza cómo se crea el usuario desde los datos del proveedor social
        """
        user = super().populate_user(request, sociallogin, data)
        
        # Extraer información adicional de Google
        extra_data = sociallogin.account.extra_data
        
        if not user.first_name and extra_data.get('given_name'):
            user.first_name = extra_data.get('given_name')
        
        if not user.last_name and extra_data.get('family_name'):
            user.last_name = extra_data.get('family_name')
        
        # Marcar email como verificado si viene de Google
        if extra_data.get('verified_email'):
            user.is_email_verified = True
        
        return user