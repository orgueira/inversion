/**
 * API client - usa rutas locales del mismo frontend por defecto,
 * o un backend externo si NEXT_PUBLIC_API_URL está configurado.
 */

// En producción (Vercel), si no hay backend configurado, usa las rutas API locales
const EXTERNAL_API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// Determinar si usar API externa o rutas locales
const USE_EXTERNAL = EXTERNAL_API_URL && EXTERNAL_API_URL !== "http://localhost:8000";

export interface MarketSummary {
  symbol: string;
  ultimo_precio: number;
  ultimo_volumen: number;
  ma20: number | null;
  ma50: number | null;
  atr14: number | null;
  volumen_relativo: number | null;
  tendencia: "Bullish" | "Bearish" | "Sideways";
  ultima_fecha: string;
}

export interface HistoricalDataPoint {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataResponse {
  data: HistoricalDataPoint[];
  summary: MarketSummary[];
  last_updated: string | null;
  cache_fresh: boolean;
  mock_mode: boolean;
}

export interface HealthResponse {
  status: string;
  mock_mode: boolean;
  timestamp: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let url: string;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (USE_EXTERNAL) {
    // Usar backend externo (FastAPI local o remoto)
    url = `${EXTERNAL_API_URL}${endpoint}`;
    if (API_KEY) {
      headers["x-api-key"] = API_KEY;
    }
  } else {
    // Usar rutas API locales del mismo frontend (Next.js API routes)
    url = `/api${endpoint}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...((options?.headers as Record<string, string>) || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export async function healthCheck(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function getMarketData(): Promise<MarketDataResponse> {
  return request<MarketDataResponse>("/market-data");
}

export async function getSymbolData(symbol: string): Promise<{
  symbol: string;
  data: HistoricalDataPoint[];
  summary: MarketSummary;
  last_updated: string | null;
}> {
  return request(`/market-data/${symbol.toUpperCase()}`);
}

export async function refreshData(): Promise<{
  success: boolean;
  message: string;
  records: number;
  symbols: number;
  last_updated: string | null;
}> {
  return request("/refresh", { method: "POST" });
}

export async function setMockMode(): Promise<{
  success: boolean;
  message: string;
  mock_mode: boolean;
}> {
  return request("/mode/mock", { method: "POST" });
}

export async function setLiveMode(): Promise<{
  success: boolean;
  message: string;
  mock_mode: boolean;
}> {
  return request("/mode/live", { method: "POST" });
}