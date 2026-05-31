# 📊 Inversión Dashboard

Dashboard de datos de mercado conectado a **Interactive Brokers (TWS/IB Gateway)**.

## Arquitectura

```
┌──────────────────────┐     REST/HTTP      ┌────────────────────────────┐
│   Vercel (Frontend)  │  ◄───────────────  │  Tu PC local (Backend)     │
│   Next.js + Tailwind │                     │  FastAPI + IB API          │
│                      │                     │                             │
│   - Dashboard web    │                     │  - Conexión persistente IB │
│   - Gráficos SVG     │                     │  - Cache de datos          │
│   - Tabla resumen    │                     │  - Modo Mock integrado     │
│   - Auto-refresh 30s │                     │  - Puerto :8000            │
└──────────────────────┘                     └──────────┬─────────────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────────┐
                                              │  TWS / IB Gateway    │
                                              │  (IBKR) :4001        │
                                              └──────────────────────┘
```

## Requisitos

### Backend (tu PC)
- Python 3.9+
- TWS o IB Gateway instalado y corriendo (o modo mock para probar sin IB)

### Frontend (Vercel)
- Node.js 18+
- Cuenta en [Vercel](https://vercel.com)

---

## 🚀 Puesta en Marcha

### 1. Backend (en tu máquina local)

```bash
# Entrar al directorio
cd backend

# Crear entorno virtual
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Configurar entorno
cp .env.example .env
# Editar .env si es necesario (mock_mode=true para probar sin IB)

# Iniciar servidor
python main.py
```

El backend arranca en **http://localhost:8000**.

**Endpoints disponibles:**
| Endpoint | Descripción |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/symbols` | Lista de símbolos |
| `GET /api/market-data` | Datos de mercado (resumen + histórico) |
| `GET /api/market-data/{symbol}` | Datos de un símbolo |
| `POST /api/refresh` | Forzar refresco de datos |
| `POST /api/mode/mock` | Cambiar a modo mock |
| `POST /api/mode/live` | Cambiar a modo live (IB real) |

### 2. Frontend (local - desarrollo)

```bash
cd frontend
npm install
cp .env.example .env.local
# Editar .env.local si es necesario

npm run dev
```

Abrir **http://localhost:3000**.

### 3. Desplegar Frontend en Vercel

**Opción A: Desde CLI de Vercel**
```bash
cd frontend
npm i -g vercel
vercel
# Sigue las instrucciones interactivas
```

**Opción B: Desde GitHub + Vercel**
1. Sube el proyecto a GitHub
2. En [vercel.com](https://vercel.com), importa el repositorio
3. Configura:
   - **Root Directory:** `frontend`
   - **Framework:** Next.js
   - **Environment Variables:**
     - `NEXT_PUBLIC_API_URL`: `http://tu-ip-local:8000` (la IP de tu PC)
     - `NEXT_PUBLIC_API_KEY`: misma API Key que en backend

### 4. Conectar Vercel con tu PC local

Para que Vercel (en la nube) se conecte a tu backend local:

1. **Opción recomendada:** Usa [ngrok](https://ngrok.com) para exponer tu backend local:
   ```bash
   ngrok http 8000
   # Te da una URL como: https://xxxx-xx-xx-xx-xx.ngrok-free.app
   ```
   Luego configura en Vercel: `NEXT_PUBLIC_API_URL=https://tu-url.ngrok-free.app`

2. **Opción alternativa:** Si tu router tiene IP pública fija, abre el puerto 8000 y usa tu IP pública.

---

## 📁 Estructura del proyecto

```
inversion/
├── backend/                    # FastAPI + IB API (tu PC local)
│   ├── main.py                # Servidor FastAPI con endpoints REST
│   ├── ib_bridge.py           # Cliente IB persistente con caché
│   ├── requirements.txt       # Dependencias Python
│   └── .env.example           # Configuración (host, puerto, mock, API key)
│
├── frontend/                   # Next.js dashboard (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx     # Layout base (HTML, font, metadata)
│   │   │   ├── page.tsx       # Página principal
│   │   │   └── globals.css    # Estilos globales + Tailwind
│   │   ├── components/
│   │   │   └── Dashboard.tsx  # Componente principal del dashboard
│   │   └── lib/
│   │       └── api.ts         # Cliente API TypeScript
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── postcss.config.js
│
├── scripts/                    # Scripts originales (legado)
│   ├── ib_connection_test.py  # Script original de conexión IB
│   └── ib_dashboard.py        # Dashboard Streamlit original
│
└── README.md
```

---

## 🔧 Configuración

### Backend (`backend/.env`)
| Variable | Default | Descripción |
|---|---|---|
| `IB_HOST` | `127.0.0.1` | Host de TWS/IB Gateway |
| `IB_PORT` | `4001` | Puerto (4001=live, 4002=paper) |
| `IB_CLIENT_ID` | `1` | Client ID para IB API |
| `MOCK_MODE` | `true` | `true` = datos simulados, `false` = IB real |
| `API_KEY` | `dev-key` | API Key para autenticación |
| `SERVER_PORT` | `8000` | Puerto del servidor FastAPI |

### Frontend (`frontend/.env.local`)
| Variable | Default | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL del backend |
| `NEXT_PUBLIC_API_KEY` | `""` | API Key (debe coincidir con backend) |

---

## 🔄 Flujo de datos

1. **Backend** arranca y conecta con IB Gateway (o entra en modo mock)
2. Cada **30 segundos** refresca datos de mercado automáticamente
3. Los datos se cachean **10 segundos** para no saturar IB API
4. **Frontend** en Vercel consulta los endpoints REST cada **30 segundos**
5. Dashboard muestra tabla, gráficos y badges de tendencia

---

## 🛡️ Seguridad

- El backend requiere **API Key** en header `x-api-key` para todas las rutas excepto `/api/health`
- IB Gateway no se expone directamente, solo a través de FastAPI
- Para producción, usa HTTPS (ngrok lo proporciona gratis)
- No compartas tu API Key públicamente

---

## 📝 Licencia

Proyecto personal de inversión.