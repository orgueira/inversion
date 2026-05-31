import sys
import random
import time
import threading
from ibapi.client import EClient
from ibapi.wrapper import EWrapper
from ibapi.contract import Contract
from ibapi.utils import iswrapper
import pandas as pd
from tabulate import tabulate


class IBConnectionTest(EWrapper, EClient):
    def __init__(self, host: str, port: int, client_id: int, mock_mode: bool = False):
        EClient.__init__(self, self)
        self.host = host
        self.port = port
        self.client_id = client_id
        self.connected_event = False
        self.mock_mode = mock_mode
        self.timer = None
        self.data = []
        self.summary = pd.DataFrame()
        self.symbols = ["SPY", "QQQ", "VOO", "DIA", "IWM", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
        self.request_ids = {}
        self.completed_requests = set()
        self.all_data_ready = threading.Event()

    @iswrapper
    def nextValidId(self, orderId: int):
        print(f"Conexión exitosa. nextValidId recibido: {orderId}")
        self.connected_event = True
        self.reqHistoricalDataForAll()

    @iswrapper
    def error(self, reqId: int, errorCode: int, errorString: str):
        print(f"Error: reqId={reqId}, código={errorCode}, mensaje={errorString}")
        if errorCode in (502, 501):
            print("Verifica que TWS/IB Gateway esté activo y el puerto sea correcto.")
        if not self.mock_mode:
            print("Activando modo mock debido a error de conexión o falta de datos.")
            self.startMock()
        self.all_data_ready.set()
        self.disconnect()

    @iswrapper
    def connectAck(self):
        print("Conexión ACK recibida")

    @iswrapper
    def historicalData(self, reqId: int, bar):
        symbol = self.request_ids.get(reqId, "Unknown")
        self.data.append({
            "symbol": symbol,
            "date": bar.date,
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume,
        })
        print(f"Histórico {symbol}: {bar.date} O:{bar.open} H:{bar.high} L:{bar.low} C:{bar.close} V:{bar.volume}")

    @iswrapper
    def historicalDataEnd(self, reqId: int, start: str, end: str):
        symbol = self.request_ids.get(reqId, "Unknown")
        print(f"Fin de histórico para {symbol}: {start} -> {end}")
        self.completed_requests.add(reqId)
        if len(self.completed_requests) == len(self.symbols):
            print("Se recibieron todos los históricos.")
            self.timer.cancel()
            self.summary = self.compute_summary(pd.DataFrame(self.data))
            self.all_data_ready.set()
            self.disconnect()

    def reqHistoricalDataForAll(self):
        if self.mock_mode:
            self.startMock()
            return

        for i, symbol in enumerate(self.symbols, start=1):
            contract = Contract()
            contract.symbol = symbol
            contract.secType = "STK"
            contract.exchange = "SMART"
            contract.currency = "USD"
            self.request_ids[i] = symbol
            self.reqHistoricalData(
                i,
                contract,
                "",
                "1 M",
                "1 day",
                "TRADES",
                1,
                1,
                False,
                [],
            )
            print(f"Solicitando histórico OHLCV para {symbol} (reqId: {i})")

        self.timer = threading.Timer(12.0, self.onTimeout)
        self.timer.start()

    def onTimeout(self):
        if not self.mock_mode and not self.all_data_ready.is_set():
            print("No se recibieron los datos de histórico en el tiempo esperado. Activando modo mock.")
            self.startMock()
            self.all_data_ready.set()

    def startMock(self):
        self.mock_mode = True
        print("Modo mock activado. Generando histórico OHLCV simulado...")
        self.data = []
        base_prices = {
            "SPY": 450,
            "QQQ": 380,
            "VOO": 445,
            "DIA": 340,
            "IWM": 200,
            "AAPL": 180,
            "MSFT": 330,
            "GOOGL": 140,
            "AMZN": 155,
            "TSLA": 240,
        }
        days = 30
        for symbol in self.symbols:
            price = base_prices.get(symbol, 100.0)
            for i in range(days):
                date = pd.Timestamp.today().normalize() - pd.Timedelta(days=days - i - 1)
                change = random.uniform(-0.02, 0.02)
                open_price = round(price * (1 + random.uniform(-0.01, 0.01)), 2)
                close_price = round(open_price * (1 + change), 2)
                high_price = round(max(open_price, close_price) * (1 + random.uniform(0, 0.01)), 2)
                low_price = round(min(open_price, close_price) * (1 - random.uniform(0, 0.01)), 2)
                volume = random.randint(500000, 3000000)
                self.data.append({
                    "symbol": symbol,
                    "date": date.strftime("%Y%m%d"),
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume": volume,
                })
                price = close_price
        self.summary = self.compute_summary(pd.DataFrame(self.data))
        self.printData()
        self.all_data_ready.set()

    def compute_summary(self, df: pd.DataFrame):
        if df.empty:
            return pd.DataFrame()

        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.sort_values(["symbol", "date"])
        summary_rows = []

        for symbol, group in df.groupby("symbol"):
            group = group.reset_index(drop=True)
            group["MA20"] = group["close"].rolling(20).mean()
            group["MA50"] = group["close"].rolling(50).mean()
            group["TR"] = group[["high", "low"]].apply(lambda row: row["high"] - row["low"], axis=1)
            group["ATR14"] = group["TR"].rolling(14).mean()
            group["VolMed20"] = group["volume"].rolling(20).mean()
            last = group.iloc[-1]
            volume_rel = None
            if pd.notna(last["VolMed20"]) and last["VolMed20"] > 0:
                volume_rel = round(last["volume"] / last["VolMed20"], 2)
            trend = "Sideways"
            if pd.notna(last["MA20"]) and pd.notna(last["MA50"]):
                if last["close"] > last["MA20"] > last["MA50"]:
                    trend = "Bullish"
                elif last["close"] < last["MA20"] < last["MA50"]:
                    trend = "Bearish"
            summary_rows.append({
                "symbol": symbol,
                "Último Precio": last["close"],
                "Último Volumen": int(last["volume"]),
                "MA20": round(last["MA20"] if pd.notna(last["MA20"]) else 0, 2),
                "MA50": round(last["MA50"] if pd.notna(last["MA50"]) else 0, 2),
                "ATR14": round(last["ATR14"] if pd.notna(last["ATR14"]) else 0, 2),
                "Volumen Relativo": volume_rel,
                "Tendencia": trend,
                "Última Fecha": last["date"].strftime("%Y-%m-%d") if hasattr(last["date"], "strftime") else last["date"],
            })

        return pd.DataFrame(summary_rows)

    def printData(self):
        print("\n--- Datos recopilados ---")
        if self.summary.empty:
            print("No hay resumen disponible.")
        else:
            print(tabulate(self.summary, headers='keys', tablefmt='grid', showindex=False))
        print(f"Total registros de histórico: {len(self.data)}")


def fetch_market_data(host: str = "127.0.0.1", port: int = 4001, client_id: int = 1, mock_mode: bool = False, timeout: int = 15):
    app = IBConnectionTest(host, port, client_id, mock_mode)

    if mock_mode:
        app.startMock()
        return pd.DataFrame(app.data), app.summary

    app.connect(host, port, client_id)
    if not app.isConnected():
        print("No se pudo iniciar la conexión local. Activando modo mock.")
        app.startMock()
        return pd.DataFrame(app.data), app.summary

    run_thread = threading.Thread(target=app.run, daemon=True)
    run_thread.start()
    app.all_data_ready.wait(timeout)
    if not app.all_data_ready.is_set():
        print("Tiempo de espera agotado. Activando modo mock...")
        app.startMock()
        if app.isConnected():
            app.disconnect()
        run_thread.join(5)
        return pd.DataFrame(app.data), app.summary

    if app.isConnected():
        app.disconnect()
    run_thread.join(5)
    if app.summary.empty:
        app.summary = app.compute_summary(pd.DataFrame(app.data))
    return pd.DataFrame(app.data), app.summary


def summarize_market_data(df: pd.DataFrame):
    if df.empty:
        return pd.DataFrame()
    app = IBConnectionTest("127.0.0.1", 4001, 1)
    return app.compute_summary(df)


def main():
    mock_mode = "--mock" in sys.argv
    host = "127.0.0.1"
    port = 4001
    client_id = 1
    timeout = 15

    df, summary = fetch_market_data(host=host, port=port, client_id=client_id, mock_mode=mock_mode, timeout=timeout)
    if summary.empty:
        print("No hay datos recopilados.")
    else:
        print(tabulate(summary, headers='keys', tablefmt='grid', showindex=False))
    print(f"Total filas de histórico: {len(df)}")


if __name__ == "__main__":
    main()
