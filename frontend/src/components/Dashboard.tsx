"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MarketDataResponse,
  MarketSummary,
  getMarketData,
  refreshData,
  setMockMode,
  setLiveMode,
  healthCheck,
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
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 500,
        border: `1px solid ${borderColors[status]}`,
        backgroundColor: bgColors[status],
        color: colors[status],
      }}
    >
      {labels[status]}
    </span>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const colors: Record<string, string> = {
    Bullish: "#4ade80",
    Bearish: "#f87171",
    Sideways: "#9ca3af",
  };
  const bgs: Record<string, string> = {
    Bullish: "#052e16",
    Bearish: "#450a0a",
    Sideways: "#1f2937",
  };
  const arrows: Record<string, string> = {
    Bullish: "▲",
    Bearish: "▼",
    Sideways: "→",
  };

  return (
    <span
      style={{
        padding: "1px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: bgs[trend] || "#1f2937",
        color: colors[trend] || "#9ca3af",
      }}
    >
      {arrows[trend] || "→"} {trend}
    </span>
  );
}

function PriceChange({ current, previous }: { current: number; previous?: number }) {
  if (!previous) return <span style={{ color: "#9ca3af" }}>—</span>;

  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;

  return (
    <span style={{ color: isPositive ? "#4ade80" : "#f87171" }}>
      {isPositive ? "+" : ""}
      {change.toFixed(2)}%
    </span>
  );
}

// ─── Tabla de resumen ────────────────────────────────────────────

function SummaryTable({
  data,
  lastPrices,
}: {
  data: MarketSummary[];
  lastPrices: Record<string, number>;
}) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>
        No hay datos disponibles.
      </div>
    );
  }

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
            <tr
              key={row.symbol}
              style={{ borderBottom: "1px solid #1f2937" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e293b80")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <td style={{ padding: "12px 16px", fontWeight: 600 }}>{row.symbol}</td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                ${row.ultimo_precio.toFixed(2)}
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                <PriceChange
                  current={row.ultimo_precio}
                  previous={lastPrices[row.symbol]}
                />
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                {(row.ultimo_volumen / 1000000).toFixed(1)}M
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                {row.ma20 ? `$${row.ma20.toFixed(2)}` : "—"}
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                {row.ma50 ? `$${row.ma50.toFixed(2)}` : "—"}
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                {row.atr14 ? `$${row.atr14.toFixed(2)}` : "—"}
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace" }}>
                {row.volumen_relativo?.toFixed(2) ?? "—"}
              </td>
              <td style={{ textAlign: "center", padding: "12px 16px" }}>
                <TrendBadge trend={row.tendencia} />
              </td>
              <td style={{ textAlign: "right", padding: "12px 16px", color: "#9ca3af", fontSize: "12px" }}>
                {row.ultima_fecha}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Gráfico simple de precios ───────────────────────────────────

function PriceChart({
  symbol,
  data,
}: {
  symbol: string;
  data: { date: string; close: number }[];
}) {
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
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.close - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <div style={{ backgroundColor: "#1e293b80", borderRadius: "8px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{symbol}</h3>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>${last.close.toFixed(2)}</div>
          <div style={{ fontSize: "14px", fontWeight: 500, color: isPositive ? "#4ade80" : "#f87171" }}>
            {isPositive ? "+" : ""}
            {change.toFixed(2)}% (30d)
          </div>
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

// ─── Selector de modo Mock/Live ─────────────────────────────────

function ModeSwitcher({
  mockMode,
  onToggle,
  loading,
}: {
  mockMode: boolean;
  onToggle: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Modo
      </span>
      <button
        onClick={(e) => {
          e.preventDefault();
          console.log("Toggle clicked, mockMode:", mockMode, "loading:", loading);
          if (!loading) onToggle();
        }}
        disabled={loading}
        style={{
          position: "relative",
          display: "inline-flex",
          height: "28px",
          width: "48px",
          alignItems: "center",
          borderRadius: "9999px",
          border: `1px solid ${mockMode ? "#854d0e" : "#166534"}`,
          backgroundColor: mockMode ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.15)",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background-color 0.3s",
          outline: "none",
          padding: 0,
          opacity: loading ? 0.5 : 1,
        }}
        title={mockMode ? "Cambiar a Live (IB real)" : "Cambiar a Mock (datos simulados)"}
      >
        <span
          style={{
            display: "inline-block",
            height: "20px",
            width: "20px",
            borderRadius: "50%",
            backgroundColor: mockMode ? "#eab308" : "#22c55e",
            transform: mockMode ? "translateX(2px)" : "translateX(26px)",
            transition: "transform 0.3s, background-color 0.3s",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        />
      </button>
      <span style={{ fontSize: "12px", fontWeight: 600, color: mockMode ? "#eab308" : "#22c55e" }}>
        {mockMode ? "Mock" : "Live"}
      </span>
    </div>
  );
}

// ─── Dashboard principal ─────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"connected" | "mock" | "error">("error");

  const [lastPrices, setLastPrices] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Loading data...");

      const health = await healthCheck();
      console.log("Health check:", health);
      setStatus(health.mock_mode ? "mock" : "connected");

      const marketData = await getMarketData();
      console.log("Market data received:", marketData.summary.length, "symbols");
      setData(marketData);

      if (marketData.summary.length > 0) {
        const prices: Record<string, number> = {};
        marketData.summary.forEach((s) => {
          prices[s.symbol] = s.ultimo_precio;
        });
        setLastPrices(prices);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
      setError(
        err instanceof Error ? err.message : "Error de conexión con el backend"
      );
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

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await refreshData();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al refrescar datos"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMock = async () => {
    try {
      const newMode = !data?.mock_mode;
      console.log("Switching to mode:", newMode ? "mock" : "live");
      if (newMode) {
        await setMockMode();
      } else {
        await setLiveMode();
      }
      await loadData();
    } catch (err) {
      console.error("Error toggling mode:", err);
      setError(
        err instanceof Error ? err.message : "Error al cambiar modo"
      );
    }
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: "1px solid #1f2937",
    backgroundColor: "#0f172acc",
    backdropFilter: "blur(8px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  };

  const mainStyle: React.CSSProperties = {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "24px 16px",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "white" }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>📊 Inversión Dashboard</h1>
            <StatusBadge status={status} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {data?.last_updated
                ? `Última actualización: ${new Date(data.last_updated).toLocaleTimeString()}`
                : "Sin datos"}
            </span>

            <ModeSwitcher
              mockMode={data?.mock_mode ?? true}
              onToggle={handleToggleMock}
              loading={loading}
            />

            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: "6px 16px",
                backgroundColor: loading ? "#1e3a5f" : "#2563eb",
                color: loading ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Cargando..." : "⟳ Refrescar"}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={mainStyle}>
        {/* Error */}
        {error && (
          <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#f87171", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div style={{
              width: "32px",
              height: "32px",
              border: "3px solid transparent",
              borderTop: "3px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <span style={{ marginLeft: "12px", color: "#9ca3af" }}>
              Conectando con el backend...
            </span>
          </div>
        )}

        {/* Charts row */}
        {data && data.summary.length > 0 && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}>
              {data.summary.slice(0, 5).map((row) => {
                const symbolData = data.data
                  .filter((d) => d.symbol === row.symbol)
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime()
                  )
                  .map((d) => ({ date: d.date, close: d.close }));

                return (
                  <PriceChart
                    key={row.symbol}
                    symbol={row.symbol}
                    data={symbolData}
                  />
                );
              })}
            </div>

            {/* Summary table */}
            <div style={{ backgroundColor: "rgba(31,41,55,0.3)", borderRadius: "8px", border: "1px solid rgba(55,65,81,0.5)", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(55,65,81,0.5)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#d1d5db", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  Resumen de Mercado
                </h2>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {data.summary.length} símbolos
                  {data.cache_fresh ? " (en caché)" : ""}
                </span>
              </div>
              <SummaryTable data={data.summary} lastPrices={lastPrices} />
            </div>

            {/* Footer info */}
            <div style={{ marginTop: "24px", textAlign: "center", fontSize: "12px", color: "#4b5563" }}>
              {data.mock_mode
                ? "⚠️ Datos simulados (modo mock). El backend no está conectado a IB."
                : "✅ Datos obtenidos de Interactive Brokers (TWS/IB Gateway)."}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && data && data.summary.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#6b7280" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
            <p>No hay datos disponibles.</p>
            <p style={{ fontSize: "14px", marginTop: "8px" }}>
              Asegúrate de que TWS/IB Gateway esté corriendo o activa el modo mock.
            </p>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
}