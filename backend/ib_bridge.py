"""
IB Bridge - Adaptador del cliente IB API para FastAPI
Mantiene una conexión persistente con TWS/IB Gateway y expone datos vía REST.
Reutiliza la lógica del proyecto original (ib_connection_test.py) pero como servicio web.
"""

import sys
import os
import random
import time
import threading
import logging
from typing import Optional
from datetime import datetime

import pandas as pd

from ibapi.client import EClient
from ibapi.wrapper import EWrapper
from ibapi.contract import Contract
from ibapi.utils import iswrapper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class IBCache:
    """Cachea los datos de mercado para no saturar IB API con cada petición."""

    def __init__(self, ttl_seconds: int = 10):
        self.data = pd.DataFrame()
        self.summary = pd.DataFrame()
        self.last_updated: Optional[datetime] = None
        self.ttl = ttl_seconds
        self._lock = threading.Lock()

    def is_fresh(self) -> bool:
        if self.last_updated is None:
            return False
        return (datetime.now() - self.last_updated).total_seconds() < self.ttl

    def update(self, data: pd.DataFrame, summary: pd.DataFrame):
        with self._lock:
            self.data = data
            self.summary = summary
            self.last_updated = datetime.now()

    def get(self):
        with self._lock:
            return self.data.copy(), self.summary.copy(), self.last_updated


class IBPersistentClient(EWrapper, EClient):
    """
    Cliente IB que mantiene conexión persistente.
    Se queda corriendo en un hilo y refresca datos periódicamente.
    """

    SYMBOLS = ["SPY", "QQQ", "VOO", "DIA", "IWM", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
    BASE_PRICES = {
        "SPY": 450, "QQQ": 380, "VOO": 445, "DIA": 340, "IWM": 200,
        "AAPL": 180, "MSFT": 330, "GOOGL": 140, "AMZN": 155, "TSLA": 240,
    }
    REFRESH_INTERVAL = 30  # segundos entre refrescos automáticos

    def __init__(self, host: str, port: int, client_id: int, mock_mode: bool = False):
        EClient.__init__(self, self)
        self.host = host
        self.port = port
        self.client_id = client_id
        self.mock_mode = mock_mode
        self.cache = IBCache(ttl_seconds=10)
        self._running = False
        self._refresh_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Para sincronización de requests
        self.request_ids = {}
        self.completed_requests = set()
        self._data_batch = []
        self._batch_lock = threading.Lock()
        self._batch_ready = threading.Event()

    # ─── IB API Callbacks ──────────────────────────────────────────

    @iswrapper
    def nextValidId(self, orderId: int):
        logger.info(f"Conexión IB exitosa. nextValidId: {orderId}")
        self.refresh_data()

    @iswrapper
    def error(self, reqId: int, errorCode: int, errorString: str):
        logger.warning(f"IB Error: reqId={reqId}, code={errorCode}, msg={errorString}")
        if errorCode in (502, 501, 504, 506):
            logger.error("Error de conexión con TWS/IB Gateway")
            if not self.mock_mode:
                logger.info("Cambiando a modo mock automáticamente")
                self.mock_mode = True
                self._generate_mock_data()

    @iswrapper
    def connectAck(self):
        logger.info("Conexión IB: ACK recibido")

    @iswrapper
    def historicalData(self, reqId: int, bar):
        symbol = self.request_ids.get(reqId, "Unknown")
        with self._batch_lock:
            self._data_batch.append({
                "symbol": symbol,
                "date": bar.date,
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            })

    @iswrapper
    def historicalDataEnd(self, reqId: int, start: str, end: str):
        symbol = self.request_ids.get(reqId, "Unknown")
        self.completed_requests.add(reqId)
        if len(self.completed_requests) == len(self.SYMBOLS):
            logger.info("Todos los datos históricos recibidos")
            self._process_batch()
            self._schedule_next_refresh()

    # ─── Lógica de datos ───────────────────────────────────────────

    def reqHistoricalDataForAll(self):
        """Solicita datos históricos a IB para todos los símbolos."""
        if self.mock_mode:
            self._generate_mock_data()
            return

        with self._batch_lock:
            self._data_batch = []
        self.completed_requests = set()
        self.request_ids = {}

        for i, symbol in enumerate(self.SYMBOLS, start=1):
            contract = Contract()
            contract.symbol = symbol
            contract.secType = "STK"
            contract.exchange = "SMART"
            contract.currency = "USD"
            self.request_ids[i] = symbol
            self.reqHistoricalData(
                i, contract, "", "1 M", "1 day", "TRADES", 1, 1, False, []
            )
            logger.info(f"Solicitando histórico para {symbol} (reqId: {i})")

    def refresh_data(self):
        """Refresca los datos (llamado periódicamente o manualmente)."""
        if self.mock_mode:
            self._generate_mock_data()
        else:
            self.reqHistoricalDataForAll()

    def _process_batch(self):
        """Procesa el batch de datos recibidos y actualiza el caché."""
        with self._batch_lock:
            if not self._data_batch:
                return
            df = pd.DataFrame(self._data_batch)

        summary = self._compute_summary(df)
        self.cache.update(df, summary)
        logger.info(f"Cache actualizado: {len(df)} registros, {len(summary)} símbolos")

    def _compute_summary(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calcula el resumen técnico igual que en el script original."""
        if df.empty:
            return pd.DataFrame()

        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.sort_values(["symbol", "date"])
        summary_rows = []

        for symbol, group in df.groupby("symbol"):
            group = group.reset_index(drop=True)
            group["MA20"] = group["close"].rolling(20).mean()
            group["MA50"] = group["close"].rolling(50).mean()
            group["TR"] = group["high"] - group["low"]
            group["ATR14"] = group["TR"].rolling(14).mean()
            group["VolMed20"] = group["volume"].rolling(20).mean()

            last = group.iloc[-1]

            volume_rel = None
            if pd.notna(last.get("VolMed20")) and last["VolMed20"] > 0:
                volume_rel = round(last["volume"] / last["VolMed20"], 2)

            trend = "Sideways"
            if pd.notna(last.get("MA20")) and pd.notna(last.get("MA50")):
                if last["close"] > last["MA20"] > last["MA50"]:
                    trend = "Bullish"
                elif last["close"] < last["MA20"] < last["MA50"]:
                    trend = "Bearish"

            summary_rows.append({
                "symbol": symbol,
                "ultimo_precio": float(last["close"]),
                "ultimo_volumen": int(last["volume"]),
                "ma20": round(last["MA20"], 2) if pd.notna(last.get("MA20")) else None,
                "ma50": round(last["MA50"], 2) if pd.notna(last.get("MA50")) else None,
                "atr14": round(last["ATR14"], 2) if pd.notna(last.get("ATR14")) else None,
                "volumen_relativo": volume_rel,
                "tendencia": trend,
                "ultima_fecha": str(last["date"].date()) if hasattr(last["date"], "date") else str(last["date"]),
            })

        return pd.DataFrame(summary_rows)

    def _generate_mock_data(self):
        """Genera datos mock idénticos al script original."""
        logger.info("Generando datos mock...")
        data = []
        days = 30

        for symbol in self.SYMBOLS:
            price = self.BASE_PRICES.get(symbol, 100.0)
            for i in range(days):
                date = pd.Timestamp.today().normalize() - pd.Timedelta(days=days - i - 1)
                change = random.uniform(-0.02, 0.02)
                open_price = round(price * (1 + random.uniform(-0.01, 0.01)), 2)
                close_price = round(open_price * (1 + change), 2)
                high_price = round(max(open_price, close_price) * (1 + random.uniform(0, 0.01)), 2)
                low_price = round(min(open_price, close_price) * (1 - random.uniform(0, 0.01)), 2)
                volume = random.randint(500000, 3000000)
                data.append({
                    "symbol": symbol,
                    "date": date.strftime("%Y%m%d"),
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume": volume,
                })
                price = close_price

        df = pd.DataFrame(data)
        summary = self._compute_summary(df)
        self.cache.update(df, summary)
        self._schedule_next_refresh()

    def _schedule_next_refresh(self):
        """Programa el próximo refresco automático."""
        if not self._running:
            return
        timer = threading.Timer(self.REFRESH_INTERVAL, self.refresh_data)
        timer.daemon = True
        timer.start()

    # ─── Ciclo de vida ─────────────────────────────────────────────

    def start(self):
        """Inicia el cliente IB y el loop de refresco."""
        self._running = True

        if self.mock_mode:
            logger.info("Iniciando en modo mock (sin conexión IB)")
            self._generate_mock_data()
            return

        logger.info(f"Conectando a IB: {self.host}:{self.port}, clientId={self.client_id}")
        self.connect(self.host, self.port, self.client_id)

        if not self.isConnected():
            logger.warning("No se pudo conectar a IB. Cambiando a modo mock.")
            self.mock_mode = True
            self._generate_mock_data()
            return

        # Correr el loop de IB en un hilo separado
        run_thread = threading.Thread(target=self.run, daemon=True)
        run_thread.start()

    def stop(self):
        """Detiene el cliente IB."""
        self._running = False
        if not self.mock_mode and self.isConnected():
            try:
                self.disconnect()
            except Exception:
                pass
        logger.info("Cliente IB detenido")

    def get_market_data(self):
        """Devuelve los datos del caché (sin llamar a IB si está fresco)."""
        data_df, summary_df, last_updated = self.cache.get()
        return data_df, summary_df, last_updated

    def force_refresh(self):
        """Fuerza un refresco inmediato de datos desde IB (o mock)."""
        self.refresh_data()
        time.sleep(2)  # Espera breve para que se recolecten datos
        return self.get_market_data()
