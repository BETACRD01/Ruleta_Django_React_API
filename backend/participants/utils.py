# participants/utils.py

import os
import re
import logging
import unicodedata
import warnings
from io import BytesIO
from typing import Optional

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils.functional import cached_property

# Pillow
from PIL import Image, ImageOps, ImageFile, UnidentifiedImageError
from PIL import Image as PILImage  # alias por claridad en algunos tips

# Evitar errores con imágenes truncadas
ImageFile.LOAD_TRUNCATED_IMAGES = True

logger = logging.getLogger(__name__)


# ==============================
# Helpers internos generales
# ==============================

def _get_setting(name: str, default):
    return getattr(settings, name, default)

def _is_image_ext(ext: str) -> bool:
    return ext in (".jpg", ".jpeg", ".png")

def _safe_get_size(file_obj) -> int:
    try:
        return int(file_obj.size)
    except Exception:
        return 0

def _safe_ext(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()

def _has_alpha(pil_image: PILImage.Image) -> bool:
    return pil_image.mode in ("RGBA", "LA") or ("transparency" in pil_image.info)


# ==============================
# URL helpers (NUEVOS)
# ==============================

def build_absolute_media_url(request, url_or_path: Optional[str]) -> Optional[str]:
    """
    Convierte una ruta/URL (p.ej. '/media/x.jpg') en URL absoluta usando el request.
    - Si ya es absoluta (http/https), se devuelve tal cual.
    - Si es relativa y hay request, se hace request.build_absolute_uri().
    - Si no hay request, se intenta prefijar con settings.SITE_URL si existe.
    """
    if not url_or_path:
        return None

    s = str(url_or_path)
    if s.startswith("http://") or s.startswith("https://"):
        return s

    # Normalizar: asegurar que empiece con '/'
    if not s.startswith("/"):
        s = "/" + s

    if request is not None:
        try:
            return request.build_absolute_uri(s)
        except Exception:
            pass

    base = getattr(settings, "SITE_URL", "").rstrip("/")
    if base:
        return f"{base}{s}"

    return s  # último recurso (relativa)


# ======================================================
# Helpers para imágenes de ruleta/premio (NUEVOS)
# ======================================================

def get_roulette_image_url_for_participation(participation, request=None) -> Optional[str]:
    """
    Devuelve la URL absoluta de la imagen de la ruleta asociada a la participación.
    Intenta usar 'roulette.cover_image.url' si existe.
    """
    try:
        roulette = getattr(participation, "roulette", None)
        if roulette and getattr(roulette, "cover_image", None):
            return build_absolute_media_url(request, roulette.cover_image.url)
    except Exception:
        pass
    return None


def get_prize_image_url_for_participation(participation, request=None) -> Optional[str]:
    """
    Devuelve la URL absoluta de la imagen del PREMIO GANADO:
      1) Si la participación es ganadora y existe 'won_prize.image', usarla.
      2) Si no hay 'won_prize.image', buscar el primer premio activo de la ruleta con imagen.
      3) Si nada tiene imagen, devolver None.
    """
    try:
        # Sólo tiene sentido si ganó
        if not getattr(participation, "is_winner", False):
            return None

        # Premio específico asignado a esta participación
        won_prize = getattr(participation, "won_prize", None)
        if won_prize and getattr(won_prize, "image", None):
            try:
                return build_absolute_media_url(request, won_prize.image.url)
            except Exception:
                pass

        # Fallback: primer premio activo con imagen dentro de la ruleta
        roulette = getattr(participation, "roulette", None)
        if roulette and hasattr(roulette, "prizes"):
            # La relación puede llamarse prizes (ManyToMany/ForeignKey related_name)
            qs = getattr(roulette, "prizes", None)
            if qs is not None:
                try:
                    first_with_image = (
                        qs.filter(is_active=True)
                        .exclude(image="")
                        .order_by("display_order")
                        .first()
                    )
                    if first_with_image and getattr(first_with_image, "image", None):
                        return build_absolute_media_url(request, first_with_image.image.url)
                except Exception:
                    pass

    except Exception as e:
        logger.warning("Error obteniendo imagen de premio para participación %s: %s",
                       getattr(participation, "id", None), e)

    return None


# ==============================
# Validaciones (original)
# ==============================

def validate_receipt_file(file):
    """
    Valida un archivo de comprobante.
    Reglas:
      - Tamaño máximo (settings.MAX_RECEIPT_SIZE, por defecto 5 MB)
      - Extensión permitida (settings.ALLOWED_RECEIPT_EXTENSIONS, por defecto .jpg/.jpeg/.png/.pdf)
      - Si es imagen: que sea decodificable y (opcional) límite de megapíxeles
    Devuelve: lista de strings con errores (vacía si todo OK).
    """
    errors = []

    if not file or not getattr(file, "name", None):
        return ["Archivo inválido."]

    max_size = _get_setting("MAX_RECEIPT_SIZE", 5 * 1024 * 1024)  # 5 MB
    allowed_exts = _get_setting("ALLOWED_RECEIPT_EXTENSIONS", [".jpg", ".jpeg", ".png", ".pdf"])
    max_pixels = _get_setting("MAX_IMAGE_PIXELS", 50_000_000)  # 50 MP por defecto

    size = _safe_get_size(file)
    if size and size > max_size:
        errors.append(f"El archivo es muy grande. Tamaño máximo: {max_size // (1024 * 1024)}MB")

    ext = _safe_ext(file.name)
    if ext not in allowed_exts:
        errors.append(f"Extensión no permitida. Permitidas: {', '.join(allowed_exts)}")

    # Si es imagen, validar que se pueda abrir y que no exceda límite de píxeles
    if _is_image_ext(ext):
        try:
            pos = file.tell() if hasattr(file, "tell") else None
            with warnings.catch_warnings():
                warnings.simplefilter("error", PILImage.DecompressionBombWarning)
                img = Image.open(file)
                img.verify()  # valida estructura

            if hasattr(file, "seek"):
                file.seek(0 if pos is None else pos)

            img = Image.open(file)
            w, h = img.size
            if (w * h) > max_pixels:
                errors.append("La imagen es demasiado grande (excede el límite de megapíxeles permitido).")
        except PILImage.DecompressionBombWarning:
            errors.append("La imagen es demasiado grande y podría no ser segura.")
        except (UnidentifiedImageError, Exception):
            errors.append("El archivo no es una imagen válida.")

        if hasattr(file, "seek"):
            file.seek(0)

    return errors


# ==============================
# Compresión (original)
# ==============================

def compress_image(file, max_width=1920, max_height=1080, quality=85):
    """
    Comprime/redimensiona una imagen si corresponde.
    - Mantiene orientación EXIF.
    - Para PNGs > 1MB, opcionalmente convierte a JPEG (fondo blanco si hay alpha).
    - Para JPEG: aplica 'quality' y optimize=True.
    - Para PNG: optimize=True, sin 'quality' (no aplica).
    Devuelve: ContentFile (si se re-encodea) o el file original si no es imagen o falla.
    """
    filename = getattr(file, "name", "upload")
    ext = _safe_ext(filename)

    if not _is_image_ext(ext):
        return file  # no es imagen → devolver tal cual

    try:
        img = Image.open(file)
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if img.width > max_width or img.height > max_height:
            img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        output = BytesIO()
        new_name = filename  # por defecto mantiene nombre

        if ext == ".png":
            if _safe_get_size(file) > 1024 * 1024:
                if _has_alpha(img):
                    bg = Image.new("RGB", img.size, (255, 255, 255))
                    bg.paste(img, mask=img.split()[-1])
                    img = bg
                else:
                    img = img.convert("RGB")
                img.save(output, format="JPEG", quality=int(quality), optimize=True)
                new_name = os.path.splitext(filename)[0] + ".jpg"
            else:
                img.save(output, format="PNG", optimize=True, compress_level=9)
        else:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(output, format="JPEG", quality=int(quality), optimize=True)

        output.seek(0)
        return ContentFile(output.getvalue(), name=new_name)

    except Exception as e:
        logger.warning("Error comprimiendo imagen '%s': %s", filename, e)
        if hasattr(file, "seek"):
            try:
                file.seek(0)
            except Exception:
                pass
        return file


# ==============================
# Información (original)
# ==============================

def get_file_info(file):
    """
    Retorna metadatos básicos del archivo.
    """
    name = getattr(file, "name", "upload")
    size = _safe_get_size(file)
    ext = _safe_ext(name)
    content_type = getattr(file, "content_type", None)

    info = {
        "name": name,
        "size": size,
        "extension": ext,
        "size_mb": round(size / (1024 * 1024), 2) if size else 0,
        "is_image": _is_image_ext(ext),
        "is_pdf": ext == ".pdf",
        "content_type": content_type,
    }
    return info


# ==============================
# Limpieza de nombres (original)
# ==============================

def clean_filename(filename):
    """
    Limpia y normaliza un nombre de archivo:
      - Normaliza Unicode (NFKD) para eliminar acentos.
      - Sustituye caracteres no permitidos por '_'.
      - Limita longitud (nombre a 50 chars).
      - Mantiene extensión original en minúsculas.
    """
    if not filename:
        return "upload"

    name, ext = os.path.splitext(filename)
    ext = ext.lower()

    # Normalizar unicode y quitar diacríticos
    name = unicodedata.normalize("NFKD", name)
    name = "".join(ch for ch in name if not unicodedata.combining(ch))

    # Limpiar caracteres no permitidos
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)

    # Evitar vacío
    if not name:
        name = "file"

    # Limitar longitud (solo el nombre, no la extensión)
    if len(name) > 50:
        name = name[:50]

    return f"{name}{ext}"
