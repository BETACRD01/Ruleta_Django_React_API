# backend/authentication/permissions.py
from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """RF1.2: Solo administradores pueden crear/gestionar ruletas"""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, "role", None) == "admin"
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Acceso si es admin o propietario del objeto.
    Añadimos has_permission para requerir autenticación antes del chequeo object-level.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        # Admin full access
        if getattr(request.user, "role", None) == "admin":
            return True
        # Propietario por atributo común
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        return False
