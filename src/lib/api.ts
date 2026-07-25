import { authStorage } from "./auth-storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  result: T | { code?: string } | null;
  message: string | null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (!response.ok || !envelope?.success) {
    const code = (envelope?.result as { code?: string } | null)?.code;
    throw new ApiError(envelope?.message ?? `Erro ${response.status}`, response.status, code);
  }

  return envelope.result as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
};

// SWR usa isso como fetcher default — GET autenticado com o mesmo envelope.
export function fetcher<T>(path: string): Promise<T> {
  return api.get<T>(path);
}
