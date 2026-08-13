import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { authStorage } from "./auth-storage";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL as string;
const RECONNECT_DELAY_MS = 3000;

export interface DeskEvent {
  type: "ticket_new" | "ticket_message" | "ticket_updated" | "message_status" | "attendant_status_changed" | "connected";
  queueId?: string;
  ticketId?: string;
  userId?: string;
  payload?: unknown;
}

type Listener = (event: DeskEvent) => void;

const RealtimeContext = createContext<{ subscribe: (listener: Listener) => () => void } | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<Listener>());
  const [enabled] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function connect() {
      if (cancelled || !authStorage.getToken()) return;

      try {
        const { token } = await api.get<{ token: string }>("/realtime-token");
        if (cancelled) return;

        socket = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`);

        socket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data) as DeskEvent;
            for (const listener of listenersRef.current) listener(parsed);
          } catch {
            // ignora mensagens que não são JSON válido
          }
        };

        socket.onclose = () => {
          if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled]);

  function subscribe(listener: Listener) {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }

  return <RealtimeContext.Provider value={{ subscribe }}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeEvent(listener: Listener) {
  const ctx = useContext(RealtimeContext);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);
}
