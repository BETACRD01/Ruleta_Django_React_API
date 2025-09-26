# backend/authentication/permissions.py
from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """RF1.2: Solo administradores pueden crear/gestionar ruletas"""
    
    message = "Solo los administradores pueden realizar esta acción."
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, "role", None) == "admin"
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Acceso si es admin o propietario del objeto.
    Requiere autenticación antes del chequeo object-level.
    """
    
    message = "No tienes permisos para acceder a este recurso."
    
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

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
    Permiso adicional para verificar que el email esté verificado
    """
    
    message = "Debes verificar tu email antes de realizar esta acción."
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_email_verified', False)
        )