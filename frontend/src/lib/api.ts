/**
 * API client con 3 modos:
 * - "frontend-mock": Datos mock generados en el frontend (sin backend)
 * - "backend-mock": Backend FastAPI en modo mock
 * - "backend-real": Backend FastAPI con datos reales de IB
 */

export type AppMode = "frontend-mock" | "backend-mock" | "backend-real";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// ─── Gestión de modo ─────────────────────────────────────────────

export function getMode(): AppMode {
  if (typeof window === "undefined") return "frontend-mock";
  return (localStorage.getItem("app-mode") as AppMode) || "frontend-mock";
}

export function setMode(mode: AppMode) {
  if (typeof window !== "undefined") {
    localStorage.setItem("app-mode", mode);
  }
}

export function getBackendUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("backend-url") || "http://localhost:8000";
}

export function setBackendUrl(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("backend-url", url);
  }
}

// ─── Interfaces ───────────────────────────────────────────────────

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

// ─── Request genérico ─────────────────────────────────────────────

async function requestLocal<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api${endpoint}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.json();
}

async function requestBackend<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const backendUrl = getBackendUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(`${backendUrl}${endpoint}`, {
    ...options,
    headers: { ...headers, ...((options?.headers as Record<string, string>) || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend Error ${res.status}`);
  return res.json();
}

// ─── API pública ──────────────────────────────────────────────────

export async function healthCheck(): Promise<HealthResponse> {
  const mode = getMode();
  if (mode === "frontend-mock") {
    return requestLocal<HealthResponse>("/health");
  }
  return requestBackend<HealthResponse>("/api/health");
}

export async function getMarketData(): Promise<MarketDataResponse> {
  const mode = getMode();
  if (mode === "frontend-mock") {
    return requestLocal<MarketDataResponse>("/market-data");
  }
  return requestBackend<MarketDataResponse>("/api/market-data");
}

export async function refreshData() {
  const mode = getMode();
  if (mode === "frontend-mock") {
    return requestLocal<any>("/market-data");
  }
  return requestBackend<any>("/api/refresh", { method: "POST" });
}

export async function setMockMode() {
  return requestBackend<any>("/api/mode/mock", { method: "POST" });
}

export async function setLiveMode() {
  return requestBackend<any>("/api/mode/live", { method: "POST" });
}