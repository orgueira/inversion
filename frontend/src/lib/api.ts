/**
 * API client para conectar con el backend FastAPI local.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export async function healthCheck(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function getMarketData(): Promise<MarketDataResponse> {
  return request<MarketDataResponse>("/api/market-data");
}

export async function getSymbolData(symbol: string): Promise<{
  symbol: string;
  data: HistoricalDataPoint[];
  summary: MarketSummary;
  last_updated: string | null;
}> {
  return request(`/api/market-data/${symbol.toUpperCase()}`);
}

export async function refreshData(): Promise<{
  success: boolean;
  message: string;
  records: number;
  symbols: number;
  last_updated: string | null;
}> {
  return request("/api/refresh", { method: "POST" });
}

export async function setMockMode(): Promise<{
  success: boolean;
  message: string;
  mock_mode: boolean;
}> {
  return request("/api/mode/mock", { method: "POST" });
}

export async function setLiveMode(): Promise<{
  success: boolean;
  message: string;
  mock_mode: boolean;
}> {
  return request("/api/mode/live", { method: "POST" });
}