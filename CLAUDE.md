# CLAUDE.md – Ruleta Web (Mantenimiento, Optimización y Documentación Técnica)

## 🧩 Información general

**Proyecto:** Ruleta Web  
**Tipo:** Aplicación Web Completa  
**Stack:** Django (Backend API REST) + React (Frontend SPA)  
**Estado actual:** Proyecto terminado — fase de **mantenimiento, optimización y documentación.**

---

## 🗂️ Estructura del Proyecto

```
/ruleta_web
├── backend/                 # Servidor Django + API REST
│   ├── apps/                # Módulos internos (usuarios, notificaciones, etc.)
│   ├── settings/            # Configuraciones (base.py, dev.py, prod.py)
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                # Interfaz en React
│   ├── src/                 # Componentes, rutas, servicios y hooks
│   ├── public/
│   ├── package.json
│   └── vite.config.js (o CRA)
│
├── docker-compose.yml
├── .env / .env.example
├── CLAUDE.md
└── README.md
```

---

## 🧠 Descripción general

**Ruleta Web** es una plataforma web que permite gestionar sorteos y participación de usuarios, combinando un **backend robusto en Django** y un **frontend interactivo en React**.

Actualmente el proyecto está en **modo mantenimiento y evolución**, con enfoque en:
- Corrección de errores residuales.
- Optimización del código y reducción de deuda técnica.
- Compatibilidad con versiones modernas de dependencias.
- Mejora de la experiencia de usuario (UX/UI).
- Documentación completa y actualizada.

---

## 🎯 Objetivos de Claude Code

Claude Code debe:
- Aplicar **buenas prácticas** en Python y JavaScript.
- Mejorar **documentación, tipado, docstrings y comentarios técnicos.**
- Realizar **refactors menores y optimizaciones** sin alterar la arquitectura.
- **No modificar:**
  - Archivos `.env`, `.env.local`, `.env.prod`.
  - Estructura de modelos o migraciones.
  - Configuraciones de producción o Docker.

---

## ⚙️ Comandos de desarrollo

### 🔸 Backend (Django)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

#### Test y lint
```bash
pytest -q
flake8 . --exclude=migrations,venv
```

#### Migraciones
```bash
python manage.py makemigrations
python manage.py migrate
```

#### Shell interactivo
```bash
python manage.py shell_plus
```

---

### 🔹 Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

#### Build y lint
```bash
npm run build
npm run lint
```

#### Tests
```bash
npm run test
```

---

## 🧰 Endpoints y servicios clave
- **API base:** `http://localhost:8000/api/`
- **Panel admin:** `http://localhost:8000/admin/`
- **WebSockets:** `ws://localhost:8000/ws/`
- **Archivos media:** `http://localhost:8000/media/`

---

## 🧱 Estilo de código y convenciones

### 🐍 Python (Django)
- Cumplir **PEP8** y usar **docstrings** Google-style.  
- Tipado opcional (`def mi_funcion(param: str) -> bool:`).  
- Logging con `logger` en lugar de `print`.  
- Excepciones específicas, nunca `except Exception`.  
- Separar lógica de negocio en *services* o *utils*.  
- Evitar código duplicado o consultas ORM innecesarias.  
- Prefijar constantes globales con mayúsculas (`MAX_PARTICIPANTS`).

### ⚛️ JavaScript / React
- Componentes funcionales con **Hooks modernos** (`useState`, `useEffect`, `useMemo`, etc.).  
- Estado global manejado con Context o Redux Toolkit.  
- Lógica repetida → extraer a `hooks/` o `utils/`.  
- Uso de **Axios** con interceptores para manejo global de errores (401, 403, 500).  
- Mantener estructura limpia y modular.

### 🏷️ Commits (Conventional Commits)
```
fix(auth): manejar error 401 en login
feat(ui): agregar animaciones en dashboard
refactor(models): limpiar imports en usuarios
docs(api): añadir docstrings en notificaciones
```

---

## 🔐 Seguridad
- No exponer secretos ni claves.  
- No editar `.env`, `.env.local`, `.env.production`.  
- No modificar `DEBUG`, `ALLOWED_HOSTS`, ni `DATABASE_URL`.  
- Revisar sanitización de inputs (forms, APIs).  
- Evitar dependencias obsoletas o sin mantenimiento.

---

## 🧠 Reglas de edición seguras
1. Cambios pequeños y reversibles.  
2. Probar antes de fusionar.  
3. Mantener compatibilidad hacia atrás.  
4. No agregar nuevas dependencias sin justificación.  
5. Documentar cada ajuste con comentarios claros.

---

## 🧪 Validación posterior a cambios

### Backend
```bash
pytest -q
python manage.py check
```

### Frontend
```bash
npm run lint
npm run dev
```

Verificar manualmente:
- `/api/` responde `200 OK`.  
- `/api/roulettes/public/metrics/` devuelve JSON válido.  
- No aparecen errores en consola de React.  

---

## 📊 Monitoreo y logs
- Los logs del backend deben guardarse en `/backend/logs/`.  
- Niveles: `DEBUG`, `INFO`, `WARNING`, `ERROR`.  
- Claude Code puede sugerir estructuras de logging más claras.  

---

## ⚙️ CI/CD y automatización
- `docker-compose up -d` para entorno completo.  
- Revisar contenedores `backend`, `frontend`, `db`, `redis`, `celery`.  
- Claude puede optimizar Dockerfiles, pero no eliminar servicios.  
- Testear integración tras cada build:  
  - Backend: `/api/health/` → 200 OK  
  - Frontend: `/` renderiza correctamente  

---

## 🧾 Dependencias principales
- **Backend:** Django, Django REST Framework, Celery, Redis, psycopg2, pytest  
- **Frontend:** React 18+, Axios, React Router, Vite, Testing Library  
- **Infraestructura:** Docker Compose, PostgreSQL, Redis  

---

## 📚 Documentación y mantenimiento
- Documentar módulos nuevos en `README.md` o `docs/`.  
- Comentar métodos clave (`# Explica propósito y parámetros`).  
- Mantener coherencia entre código y documentación.  
- Claude Code puede generar documentación Markdown o HTML bajo `/docs/`.

---

## 🚀 Roadmap de mantenimiento
| Fase | Objetivo | Responsable |
|------|-----------|-------------|
| 1 | Corrección de errores Django | Backend |
| 2 | Limpieza y optimización React | Frontend |
| 3 | Mejoras UX/UI y feedback | Frontend |
| 4 | Documentación técnica final | Todos |
| 5 | Dockerización avanzada | DevOps |

---

## ✅ Misión de Claude Code
> Mantener el proyecto **Ruleta Web** estable, limpio y documentado.  
> Apoyar al desarrollador en detectar, corregir y optimizar sin alterar la base establecida.  
> Mejorar calidad, rendimiento y legibilidad del sistema completo.
