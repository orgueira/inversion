# Inversión Dashboard - Next.js + Vercel

## Arquitectura Propuesta

```
┌─────────────────────┐      REST/HTTP       ┌──────────────────────────────┐
│     Vercel          │  ◄────────────────   │   Tu servidor / VPS         │
│  (Frontend Next.js) │                       │   (Python FastAPI + IB API) │
│                     │                       │                              │
│  - Dashboard        │                       │  - FastAPI server            │
│  - Gráficos         │                       │  - ibapi (conexión TWS/IB)  │
│  - Tablas           │                       │  - Endpoints REST            │
│  - Responsive       │                       │  - Cache en memoria          │
└─────────────────────┘                       └──────────────────────────────┘
                                                           │
                                                           ▼
                                              ┌──────────────────────┐
                                              │  TWS / IB Gateway    │
                                              │  (IBKR local/VPS)    │
                                              └──────────────────────┘
```

## ¿Dónde poner el backend?

| Opción | Descripción | Coste |
|--------|-------------|-------|
| **Tu propio PC en casa** | El backend corre en tu máquina local con IB Gateway. Vercel se conecta a tu IP pública + puerto. | Gratis (tu electricidad) |
| **VPS barato** (DigitalOcean, Hetzner, etc.) | Montas IB Gateway en un VPS con Ubuntu, y el backend FastAPI ahí mismo | ~$4-6/mes |
| **Raspberry Pi en casa** | Similar al PC local pero con consumo mínimo | ~€5/mes electricidad |

## Endpoints del Backend (FastAPI)

```
GET  /api/symbols          → Lista de símbolos configurados
GET  /api/market-data      → Precios actuales de todos los símbolos
GET  /api/market-data/{symbol} → Precio de un símbolo específico
POST /api/refresh          → Forzar refresco de datos desde IB
GET  /api/health           → Health check
```

## Flujo de trabajo

1. **Backend** (tu máquina/VPS): Corre un proceso Python con FastAPI que mantiene conexión persistente con IB Gateway. Expone endpoints REST.
2. **Vercel** (frontend): Next.js con Tailwind, Recharts para gráficos. Llama a los endpoints del backend para mostrar datos en tiempo real.
3. **Caching**: El backend cachea los datos ~5-15 segundos para no saturar IB API.

---

## ✅ Ventajas de esta arquitectura

- **Frontend en Vercel**: CDN global, SSL gratis, despliegue automático desde GitHub
- **Backend flexible**: Puedes cambiarlo, escalarlo o apagarlo sin afectar el frontend
- **Sin vendor lock-in**: El backend puede migrarse fácilmente
- **Datos reales IB**: Conectado directamente a tu cuenta de IBKR

## ⚠️ Consideraciones de seguridad

- Usar HTTPS (Let's Encrypt o similar) en el backend
- Autenticación simple (API key) entre frontend y backend
- No exponer IB Gateway directamente, solo el API wrapper (FastAPI)