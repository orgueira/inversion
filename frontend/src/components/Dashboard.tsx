"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MarketDataResponse,
  MarketSummary,
  getMarketData,
  refreshData,
  healthCheck,
  setMode,
  getMode,
  setBackendUrl,
  getBackendUrl,
  AppMode,
  setMockMode,
  setLiveMode,
} from "@/lib/api";

// ─── Componentes internos ────────────────────────────────────────

function StatusBadge({ status }: { status: "connected" | "mock" | "error" }) {
  const colors = {
    connected: "green",
    mock: "yellow",
    error: "red",
  };
  const labels = {
    connected: "● IB Live",
    mock: "● Mock",
    error: "● Error",
  };
  const bgColors = {
    connected: "#052e16",
    mock: "#422006",
    error: "#450a0a",
  };
  const borderColors = {
    connected: "#166534",
    mock: "#854d0e",
    error: "#991b1b",
  };
  return (
    <span style={{ padding: "2px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 500, border: `1px solid ${borderColors[status]}`, backgroundColor: bgColors[status], color: colors[status] }}>
      {labels[status]}
    </span>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const colors: Record<string, string> = { Bullish: "#4ade80", Bearish: "#f87171", Sideways: "#9ca3af" };
  const bgs: Record<string, string> = { Bullish: "#052e16", Bearish: "#450a0a", Sideways: "#1f2937" };
  const arrows: Record<string, string> = { Bullish: "▲", Bearish: "▼", Sideways: "→" };
  return (
    <span style={{ padding: "1px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 500, backgroundColor: bgs[trend] || "#1f2937", color: colors[trend] || "#9ca3af" }}>
      {arrows[trend] || "→"} {trend}
    </span>
  );
}

function PriceChange({ current, previous }: { current: number; previous?: number }) {
  if (!previous) return <span style={{ color: "#9ca3af" }}>—</span>;
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;
  return <span style={{ color: isPositive ? "#4ade80" : "#f87171" }}>{isPositive ? "+" : ""}{change.toFixed(2)}%</span>;
}

// ─── Tabla de resumen ────────────────────────────────────────────

function SummaryTable({ data, lastPrices }: { data: MarketSummary[]; lastPrices: Record<string, number> }) {
  if (data.length === 0) return <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>No hay datos disponibles.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #374151", color: "#9ca3af", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em" }}>
            <th style={{ textAlign: "left", padding: "12px 16px" }}>Símbolo</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>Precio</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>Cambio %</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>Volumen</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>MA20</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>MA50</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>ATR14</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>Vol. Rel.</th>
            <th style={{ textAlign: "center", padding: "12px 16px" }}>Tendencia</th>
            <th style={{ textAlign: "right", padding: "12px 16px" }}>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.symbol} style={{ borderBottom: "1px solid #1f2937" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e293b80")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
              <td style={{ padding: "12px 16px", fontWeight: 600 }}>{row.symbol}</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>${row.ultimo_precio.toFixed(2)}</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}><PriceChange current={row.ultimo_precio} previous={lastPrices[row.symbol]} /></td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>{(row.ultimo_volumen / 1000000).toFixed(1)}M</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>{row.ma20 ? `$${row.ma20.toFixed(2)}` : "—"}</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>{row.ma50 ? `$${row.ma50.toFixed(2)}` : "—"}</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>{row.atr14 ? `$${row.atr14.toFixed(2)}` : "—"}</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>{row.volumen_relativo?.toFixed(2) ?? "—"}</td>
              <td style={{ textAlign: "center", padding: "12px 16px" }}><TrendBadge trend={row.tendencia} /></td>
              <td style={{ textAlign: "right", padding: "12px 16px", color: "#9ca3af", fontSize: "12px" }}>{row.ultima_fecha}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Gráfico simple de precios ───────────────────────────────────

function PriceChart({ symbol, data }: { symbol: string; data: { date: string; close: number }[] }) {
  if (data.length === 0) return null;
  const last = data[data.length - 1];
  const first = data[0];
  const change = ((last.close - first.close) / first.close) * 100;
  const isPositive = change >= 0;
  const prices = data.map((d) => d.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 200;
  const height = 40;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d.close - min) / range) * height}`);

  return (
    <div style={{ backgroundColor: "#1e293b80", borderRadius: "8px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{symbol}</h3>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>${last.close.toFixed(2)}</div>
          <div style={{ fontSize: "14px", fontWeight: 500, color: isPositive ? "#4ade80" : "#f87171" }}>{isPositive ? "+" : ""}{change.toFixed(2)}% (30d)</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "40px" }} preserveAspectRatio="none">
        <polyline points={points.join(" ")} fill="none" stroke={isPositive ? "#16a34a" : "#dc2626"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,${height} ${points.join(" ")} ${width},${height}`} fill={isPositive ? "#16a34a" : "#dc2626"} fillOpacity="0.1" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
        <span>${min.toFixed(2)}</span>
        <span>${max.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── Selector de 3 modos ─────────────────────────────────────────

function ModeSelector({ currentMode, onModeChange, backendUrl, onUrlChange }: {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  backendUrl: string;
  onUrlChange: (url: string) => void;
}) {
  const modes: { key: AppMode; label: string; color: string; description: string }[] = [
    { key: "frontend-mock", label: "Mock Frontend", color: "#3b82f6", description: "Sin backend" },
    { key: "backend-mock", label: "Mock Backend", color: "#eab308", description: "Backend simulado" },
    { key: "backend-real", label: "Live IB", color: "#22c55e", description: "Interactive Brokers" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Modo</span>
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onModeChange(m.key)}
          style={{
            padding: "4px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            border: `1px solid ${currentMode === m.key ? m.color : "#374151"}`,
            backgroundColor: currentMode === m.key ? `${m.color}20` : "transparent",
            color: currentMode === m.key ? m.color : "#9ca3af",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title={m.description}
        >
          {m.label}
        </button>
      ))}
      {currentMode !== "frontend-mock" && (
        <input
          type="text"
          value={backendUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="http://localhost:8000"
          style={{
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #374151",
            backgroundColor: "#1f2937",
            color: "#e2e8f0",
            fontSize: "11px",
            width: "200px",
          }}
        />
      )}
    </div>
  );
}

// ─── Dashboard principal ─────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"connected" | "mock" | "error">("error");
  const [mode, setModeState] = useState<AppMode>("frontend-mock");
  const [backendUrlInput, setBackendUrlInput] = useState("http://localhost:8000");
  const [lastPrices, setLastPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    setModeState(getMode());
    setBackendUrlInput(getBackendUrl());
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await healthCheck();
      setStatus(health.mock_mode ? "mock" : "connected");
      const marketData = await getMarketData();
      setData(marketData);
      if (marketData.summary.length > 0) {
        const prices: Record<string, number> = {};
        marketData.summary.forEach((s) => { prices[s.symbol] = s.ultimo_precio; });
        setLastPrices(prices);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleModeChange = async (newMode: AppMode) => {
    setMode(newMode);
    setModeState(newMode);
    if (newMode === "backend-mock") {
      try { await setMockMode(); } catch (e) { /* ignore */ }
    }
    if (newMode === "backend-real") {
      try { await setLiveMode(); } catch (e) { /* ignore */ }
    }
    await loadData();
  };

  const handleUrlChange = (url: string) => {
    setBackendUrlInput(url);
    setBackendUrl(url);
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await refreshData();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al refrescar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "white" }}>
      <header style={{ borderBottom: "1px solid #1f2937", backgroundColor: "#0f172acc", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>📊 Inversión Dashboard</h1>
            <StatusBadge status={status} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>{data?.last_updated ? `Última actualización: ${new Date(data.last_updated).toLocaleTimeString()}` : "Sin datos"}</span>
            <ModeSelector currentMode={mode} onModeChange={handleModeChange} backendUrl={backendUrlInput} onUrlChange={handleUrlChange} />
            <button onClick={handleRefresh} disabled={loading} style={{ padding: "6px 16px", backgroundColor: loading ? "#1e3a5f" : "#2563eb", color: loading ? "#9ca3af" : "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Cargando..." : "⟳ Refrescar"}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 16px" }}>
        {error && <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#f87171", fontSize: "14px" }}>{error}</div>}

        {loading && !data && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid transparent", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span style={{ marginLeft: "12px", color: "#9ca3af" }}>Conectando...</span>
          </div>
        )}

        {data && data.summary.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
              {data.summary.slice(0, 5).map((row) => {
                const symbolData = data.data.filter((d) => d.symbol === row.symbol).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((d) => ({ date: d.date, close: d.close }));
                return <PriceChart key={row.symbol} symbol={row.symbol} data={symbolData} />;
              })}
            </div>
            <div style={{ backgroundColor: "rgba(31,41,55,0.3)", borderRadius: "8px", border: "1px solid rgba(55,65,81,0.5)", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(55,65,81,0.5)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#d1d5db", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Resumen de Mercado</h2>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>{data.summary.length} símbolos{data.cache_fresh ? " (caché)" : ""}</span>
              </div>
              <SummaryTable data={data.summary} lastPrices={lastPrices} />
            </div>
            <div style={{ marginTop: "24px", textAlign: "center", fontSize: "12px", color: "#4b5563" }}>
              {mode === "frontend-mock" && "ℹ️ Datos mock generados en el frontend (sin backend)."}
              {mode === "backend-mock" && "⚠️ Datos simulados del backend FastAPI."}
              {mode === "backend-real" && "✅ Datos reales de Interactive Brokers (TWS/IB Gateway)."}
            </div>
          </>
        )}

        {!loading && data && data.summary.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#6b7280" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
            <p>No hay datos disponibles.</p>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
    </div>
  );
}