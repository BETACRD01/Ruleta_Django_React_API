# backend/celery.py
import os
import ssl
from celery import Celery
from celery.schedules import crontab


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')

# Cargar configuración desde Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Configuración adicional para Redis Cloud con SSL
broker_url = os.getenv('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
result_backend = os.getenv('CELERY_RESULT_BACKEND', 'redis://127.0.0.1:6379/0')

# Si usamos rediss:// (Redis con SSL), configurar SSL
if broker_url.startswith('rediss://'):
    app.conf.update(
        broker_url=broker_url,
        result_backend=result_backend,
        broker_use_ssl={
            'ssl_cert_reqs': ssl.CERT_NONE,
            'ssl_ca_certs': None,
            'ssl_certfile': None,
            'ssl_keyfile': None,
        },
        redis_backend_use_ssl={
            'ssl_cert_reqs': ssl.CERT_NONE,
            'ssl_ca_certs': None,
            'ssl_certfile': None,
            'ssl_keyfile': None,
        }
    )
    print("✓ Celery configurado con Redis SSL (rediss://)")
else:
    app.conf.update(
        broker_url=broker_url,
        result_backend=result_backend,
    )
    print("✓ Celery configurado con Redis sin SSL (redis://)")

# Configuración adicional de Celery
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Guayaquil',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=3600,
    result_extended=True,
)

# Autodescubrir tareas en todas las apps Django
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
    return 'Debug task executed successfully!'

app.conf.beat_schedule = {
    'cleanup-old-tasks': {
        'task': 'backend.celery.cleanup_task',
        'schedule': crontab(hour=0, minute=0),
    },
}

@app.task
def cleanup_task():
    """Tarea de ejemplo para limpieza programada"""
    print("Ejecutando limpieza programada...")
    return "Limpieza completada"