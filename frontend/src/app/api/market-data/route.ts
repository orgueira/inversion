import { NextResponse } from "next/server";

const SYMBOLS = ["SPY", "QQQ", "VOO", "DIA", "IWM", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

const BASE_PRICES: Record<string, number> = {
  SPY: 530, QQQ: 440, VOO: 490, DIA: 390, IWM: 210,
  AAPL: 195, MSFT: 430, GOOGL: 175, AMZN: 185, TSLA: 260,
};

function generateMockData() {
  const data = [];
  const days = 30;

  for (const symbol of SYMBOLS) {
    let price = BASE_PRICES[symbol] || 100;
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const change = (Math.random() - 0.48) * 0.04;
      const open = +(price * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2);
      const close = +(open * (1 + change)).toFixed(2);
      const high = +(Math.max(open, close) * (1 + Math.random() * 0.01)).toFixed(2);
      const low = +(Math.min(open, close) * (1 - Math.random() * 0.01)).toFixed(2);
      const volume = Math.floor(500000 + Math.random() * 2500000);
      data.push({ symbol, date: date.toISOString().split("T")[0].replace(/-/g, ""), open, high, low, close, volume });
      price = close;
    }
  }
  return data;
}

function computeSummary(data: any[]) {
  const grouped: Record<string, any[]> = {};
  for (const d of data) {
    if (!grouped[d.symbol]) grouped[d.symbol] = [];
    grouped[d.symbol].push(d);
  }

  return Object.entries(grouped).map(([symbol, bars]) => {
    bars.sort((a: any, b: any) => a.date.localeCompare(b.date));
    const closes = bars.map((b: any) => b.close);
    const volumes = bars.map((b: any) => b.volume);

    const ma20 = closes.length >= 20 ? +(closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20).toFixed(2) : null;
    const ma50 = closes.length >= 20 ? +(closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20).toFixed(2) : null;
    const avgVol = volumes.length >= 20 ? volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : null;
    const lastClose = closes[closes.length - 1];
    const lastVol = volumes[volumes.length - 1];
    const atr14 = bars.length >= 14 ? +(bars.slice(-14).reduce((sum: number, b: any) => sum + (b.high - b.low), 0) / 14).toFixed(2) : null;
    const volRel = avgVol && avgVol > 0 ? +(lastVol / avgVol).toFixed(2) : null;

    let trend = "Sideways";
    if (ma20 !== null && ma50 !== null) {
      if (lastClose > ma20 && ma20 > ma50) trend = "Bullish";
      else if (lastClose < ma20 && ma20 < ma50) trend = "Bearish";
    }

    return {
      symbol,
      ultimo_precio: lastClose,
      ultimo_volumen: lastVol,
      ma20, ma50, atr14,
      volumen_relativo: volRel,
      tendencia: trend,
      ultima_fecha: bars[bars.length - 1].date,
    };
  });
}

export async function GET() {
  const data = generateMockData();
  const summary = computeSummary(data);

  return NextResponse.json({
    data,
    summary,
    last_updated: new Date().toISOString(),
    cache_fresh: true,
    mock_mode: true,
  });
}