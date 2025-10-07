# backend/utils.py o donde prefieras
import os
import uuid
from django.utils.text import slugify

def get_filename(filename, request):
    """
    Genera nombre de archivo seguro y único para CKEditor
    """
    # Obtener extensión
    ext = filename.split('.')[-1].lower()
    
    # Solo permitir extensiones seguras
    allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    if ext not in allowed:
        raise ValueError(f"Extensión {ext} no permitida")
    
    # Generar nombre único
    unique_name = f"{uuid.uuid4().hex[:12]}_{slugify(filename.split('.')[0])}"
    return f"{unique_name}.{ext}"