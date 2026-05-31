"""
FastAPI Server - Backend para el Dashboard de Inversión
Expone datos de mercado de Interactive Brokers vía REST.
Corre en tu máquina local y se conecta a TWS/IB Gateway.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pandas as pd

from ib_bridge import IBPersistentClient

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ─── Configuración ─────────────────────────────────────────────────

IB_HOST = os.getenv("IB_HOST", "127.0.0.1")
IB_PORT = int(os.getenv("IB_PORT", "4001"))
IB_CLIENT_ID = int(os.getenv("IB_CLIENT_ID", "1"))
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"
API_KEY = os.getenv("API_KEY", "dev-key")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))

# Cliente IB global (persistente)
ib_client: Optional[IBPersistentClient] = None


# ─── Seguridad ─────────────────────────────────────────────────────

async def verify_api_key(x_api_key: str = Header(None)):
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="API Key inválida")
    return x_api_key


# ─── Lifecycle ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicia y detiene el cliente IB con la app."""
    global ib_client
    logger.info(f"Iniciando servidor... (mock_mode={MOCK_MODE})")
    ib_client = IBPersistentClient(
        host=IB_HOST,
        port=IB_PORT,
        client_id=IB_CLIENT_ID,
        mock_mode=MOCK_MODE,
    )
    ib_client.start()
    yield
    logger.info("Deteniendo servidor...")
    if ib_client:
        ib_client.stop()


app = FastAPI(
    title="Inversión Dashboard API",
    description="API de datos de mercado desde Interactive Brokers",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: permitir peticiones desde cualquier origen (Vercel, localhost, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Endpoints ─────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check del servidor."""
    return {
        "status": "ok",
        "mock_mode": ib_client.mock_mode if ib_client else True,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/symbols")
async def get_symbols(api_key: str = Depends(verify_api_key)):
    """Devuelve la lista de símbolos configurados."""
    symbols = ib_client.SYMBOLS if ib_client else []
    return {"symbols": symbols, "count": len(symbols)}


@app.get("/api/market-data")
async def get_market_data(api_key: str = Depends(verify_api_key)):
    """
    Devuelve el resumen de datos de mercado de todos los símbolos.
    Datos cacheados ~10 segundos para no saturar IB.
    """
    if not ib_client:
        raise HTTPException(status_code=503, detail="Cliente IB no inicializado")

    data_df, summary_df, last_updated = ib_client.get_market_data()

    if summary_df.empty:
        return {
            "data": [],
            "summary": [],
            "last_updated": None,
            "mock_mode": ib_client.mock_mode,
        }

    # Convertir DataFrames a JSON
    summary_list = summary_df.to_dict(orient="records")
    data_list = data_df.to_dict(orient="records") if not data_df.empty else []

    return {
        "data": data_list,
        "summary": summary_list,
        "last_updated": last_updated.isoformat() if last_updated else None,
        "cache_fresh": ib_client.cache.is_fresh(),
        "mock_mode": ib_client.mock_mode,
    }


@app.get("/api/market-data/{symbol}")
async def get_symbol_data(symbol: str, api_key: str = Depends(verify_api_key)):
    """
    Devuelve datos de un símbolo específico.
    """
    if not ib_client:
        raise HTTPException(status_code=503, detail="Cliente IB no inicializado")

    data_df, summary_df, last_updated = ib_client.get_market_data()

    if data_df.empty:
        raise HTTPException(status_code=404, detail="No hay datos disponibles")

    # Filtrar por símbolo
    symbol_data = data_df[data_df["symbol"] == symbol.upper()]
    symbol_summary = summary_df[summary_df["symbol"] == symbol.upper()]

    if symbol_data.empty:
        raise HTTPException(status_code=404, detail=f"Símbolo '{symbol}' no encontrado")

    return {
        "symbol": symbol.upper(),
        "data": symbol_data.to_dict(orient="records"),
        "summary": symbol_summary.to_dict(orient="records")[0] if not symbol_summary.empty else None,
        "last_updated": last_updated.isoformat() if last_updated else None,
    }


@app.post("/api/refresh")
async def refresh_data(api_key: str = Depends(verify_api_key)):
    """
    Fuerza un refresco de datos desde IB (o mock).
    """
    if not ib_client:
        raise HTTPException(status_code=503, detail="Cliente IB no inicializado")

    logger.info("Refrescando datos...")
    data_df, summary_df, last_updated = ib_client.force_refresh()

    return {
        "success": True,
        "message": "Datos actualizados",
        "records": len(data_df),
        "symbols": len(summary_df),
        "last_updated": last_updated.isoformat() if last_updated else None,
    }


@app.post("/api/mode/mock")
async def set_mock_mode(api_key: str = Depends(verify_api_key)):
    """
    Cambia a modo mock (genera datos simulados).
    """
    if not ib_client:
        raise HTTPException(status_code=503, detail="Cliente IB no inicializado")

    ib_client.mock_mode = True
    ib_client.force_refresh()
    logger.info("Modo mock activado")

    return {
        "success": True,
        "message": "Modo mock activado",
        "mock_mode": True,
    }


@app.post("/api/mode/live")
async def set_live_mode(api_key: str = Depends(verify_api_key)):
    """
    Cambia a modo live (intenta conectar con IB real).
    Si no hay TWS/IB Gateway disponible, vuelve automáticamente a modo mock.
    """
    if not ib_client:
        raise HTTPException(status_code=503, detail="Cliente IB no inicializado")

    ib_client.mock_mode = False
    ib_client.force_refresh()
    logger.info("Modo live activado")

    return {
        "success": True,
        "message": "Modo live activado (intentando conectar con IB)",
        "mock_mode": False,
    }


# ─── Entry point ───────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=SERVER_PORT,
        reload=False,
        log_level="info",
    )