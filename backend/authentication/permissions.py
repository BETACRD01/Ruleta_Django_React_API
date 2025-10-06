# backend/authentication/permissions.py
from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """
    RF1.2: Solo administradores pueden crear/gestionar ruletas.
    Verifica que el usuario esté autenticado y tenga rol de admin.
    """
    
    message = "Solo los administradores pueden realizar esta acción."
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, "role", None) == "admin"
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permite acceso si el usuario es administrador o propietario del objeto.
    
    Para usar este permiso correctamente:
    - Combínalo con IsAuthenticated en permission_classes
    - El objeto debe tener atributo 'user' o 'created_by'
    
    Ejemplo:
        permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    """
    
    message = "No tienes permisos para acceder a este recurso."
    
    def has_object_permission(self, request, view, obj):
        # Admin tiene acceso completo
        if getattr(request.user, "role", None) == "admin":
            return True
        
        # Verificar propiedad del objeto
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False


class IsEmailVerified(permissions.BasePermission):
    """
    Requiere que el email del usuario esté verificado.
    Útil para acciones sensibles como participar en ruletas o reclamar premios.
    """
    
    message = "Debes verificar tu email antes de realizar esta acción."
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_email_verified', False)
        )