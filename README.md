# JEL QA Platform

Plataforma de evaluación de calidad para atención al cliente de JuegaEnLínea.
Analiza conversaciones de Respond.io con métricas cuantitativas y evaluación IA (DeepSeek).

## Arquitectura

- **Backend:** Node.js + Express
- **Frontend:** React + Vite + Tailwind CSS
- **Base de datos:** MongoDB (instancia compartida con n8n)
- **IA:** DeepSeek API (análisis cualitativo)
- **Deploy:** Docker en Easypanel

## Deploy en Easypanel

### Opción 1: Desde GitHub (recomendado)

1. Sube este repo a GitHub
2. En Easypanel, crea un nuevo **App Service**
3. Conecta el repo de GitHub
4. Configura las variables de entorno:

```
MONGODB_URI=mongodb://tu-usuario:tu-password@mongodb:27017/jel_qa?authSource=admin
DEEPSEEK_API_KEY=sk-tu-key-de-deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
NODE_ENV=production
PORT=3000
```

5. El Dockerfile se detecta automáticamente
6. Configura el dominio (ej: `qa.tudominio.com`)
7. Deploy

### Opción 2: Usando tu MongoDB existente

Si ya tienes MongoDB corriendo en Easypanel (para n8n), apunta `MONGODB_URI` a esa instancia.
La app creará una base de datos `jel_qa` separada automáticamente.

Ejemplo si tu MongoDB está en el mismo stack de Easypanel:
```
MONGODB_URI=mongodb://root:tuPassword@nombre-del-servicio-mongo:27017/jel_qa?authSource=admin
```

### Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGODB_URI` | Connection string de MongoDB | `mongodb://...` |
| `DEEPSEEK_API_KEY` | API key de DeepSeek | `sk-...` |
| `DEEPSEEK_BASE_URL` | Base URL de DeepSeek API | `https://api.deepseek.com` |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno | `production` |

## Uso

### 1. Configuración inicial

1. Ve a **Agentes** y carga los agentes con su ID de Respond.io y nombre
2. Ve a **Categorías** → "Importar de conversaciones" (se auto-importan después de la primera carga)
3. Opcionalmente carga **Contactos**

### 2. Evaluar un día

1. Exporta los CSVs desde Respond.io:
   - **Mensajes:** Messages report del día
   - **Conversaciones:** Conversations report del día
2. Ve a **Evaluar**, selecciona instancia y fecha
3. Sube ambos archivos
4. El sistema parsea, cruza mensajes con conversaciones, calcula scores cuantitativos y envía a DeepSeek
5. Revisa los resultados en **Dashboard** y **Evaluaciones**

### 3. Scoring

**Cuantitativo (60% del score final):**
- Tiempo primera respuesta (30%)
- Tiempo de resolución (25%)
- Ratio de respuestas (20%)
- Tiempo promedio entre respuestas (15%)
- Eficiencia de mensajes (10%)

**Cualitativo - DeepSeek (40% del score final):**
- Tono del agente
- Empatía
- Resolución del problema
- Profesionalismo

**Notas:**
- A: 90-100
- B: 75-89
- C: 60-74
- D: 40-59
- F: 0-39

## Desarrollo local

```bash
# Backend
npm install
cp .env.example .env  # editar con tus credenciales
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

O con Docker Compose:
```bash
docker-compose up --build
```

## API Endpoints

### Upload
- `POST /api/upload` - Subir CSVs (multipart)
- `GET /api/upload/:batchId/status` - Estado del batch
- `GET /api/upload` - Lista de batches

### Dashboard
- `GET /api/dashboard/summary` - KPIs globales
- `GET /api/dashboard/agents` - Ranking de agentes
- `GET /api/dashboard/categories` - Distribución de categorías
- `GET /api/dashboard/timeline` - Score por día

### Evaluaciones
- `GET /api/evaluations` - Lista con filtros
- `GET /api/evaluations/:conversationId` - Detalle + mensajes

### CRUD
- `GET/POST /api/agents` - Agentes
- `GET/POST /api/categories` - Categorías
- `GET/POST /api/contacts` - Contactos
- Todos soportan `/bulk` para carga masiva
