import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { History, LogOut, Send } from "lucide-react";
import { toast } from "sonner";
import fluxyLogo from "@/assets/Logo.png";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearSession, setAttendantStatus, type AttendantStatus } from "@/store/slices/auth-slice";
import type { Queue, Ticket } from "@/types/domain";

const STATUS_LABELS: Record<AttendantStatus, string> = { ONLINE: "Online", PAUSED: "Pausa", OFFLINE: "Offline" };
const STATUS_DOT: Record<AttendantStatus, string> = { ONLINE: "bg-emerald-500", PAUSED: "bg-amber-500", OFFLINE: "bg-muted-foreground" };

// "Agora" pro que acabou de chegar (menos de 1 min), senão hora cheia em
// 12h com AM/PM — igual ao pedido, sem depender do locale do date-fns.
function formatTicketTime(iso: string): string {
  const date = new Date(iso);
  if (Date.now() - date.getTime() < 60_000) return "Agora";
  const hours24 = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}

/// Shell no estilo WhatsApp: lista de tickets (contatos) fixa à esquerda,
/// conteúdo do ticket selecionado (chat + metadados) no <Outlet/>. Sem página
/// separada de "aguardando" — só o contador + botão que puxa o mais antigo.
export function DeskLayout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const activeTicketId = location.pathname.match(/^\/tickets\/([^/]+)/)?.[1];

  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const userName = useAppSelector((s) => s.auth.user?.name);
  const attendantStatus = useAppSelector((s) => s.auth.attendantStatus);
  const [changingStatus, setChangingStatus] = useState(false);

  const [pulling, setPulling] = useState(false);
  // Ticket recebeu mensagem nova enquanto o atendente não estava com a
  // conversa aberta — só estado de UI (não persiste), some assim que o
  // ticket em questão é aberto.
  const [unreadTicketIds, setUnreadTicketIds] = useState<Set<string>>(new Set());

  const { data: waiting, mutate: mutateWaiting } = useSWR<Ticket[]>("/tickets?status=waiting");
  const { data: mine, mutate: mutateMine } = useSWR<Ticket[]>("/tickets?status=mine");
  const { data: queues } = useSWR<Queue[]>("/queues");
  const dispatchQueues = queues?.filter((q) => q.serviceIsland?.allowActiveDispatch) ?? [];

  useRealtimeEvent((event) => {
    if (event.type === "attendant_status_changed") {
      const payload = event.payload as { userId: string; status: AttendantStatus } | undefined;
      if (payload && payload.userId === currentUserId) dispatch(setAttendantStatus(payload.status));
      return;
    }

    mutateWaiting();
    mutateMine();

    if (event.type === "ticket_message" && event.ticketId && event.ticketId !== activeTicketId) {
      const ticketId = event.ticketId;
      setUnreadTicketIds((prev) => (prev.has(ticketId) ? prev : new Set(prev).add(ticketId)));
    }
  });

  useEffect(() => {
    if (!activeTicketId) return;
    setUnreadTicketIds((prev) => {
      if (!prev.has(activeTicketId)) return prev;
      const next = new Set(prev);
      next.delete(activeTicketId);
      return next;
    });
  }, [activeTicketId]);

  async function handlePullNext() {
    const next = waiting?.[0];
    if (!next) return;

    setPulling(true);
    try {
      await api.post(`/tickets/${next.id}/pull`);
      await Promise.all([mutateWaiting(), mutateMine()]);
      navigate(`/tickets/${next.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "TICKET_ALREADY_TAKEN") {
        toast.error("Este ticket já foi puxado por outro atendente.");
        mutateWaiting();
      } else {
        toast.error("Não foi possível puxar o ticket.");
      }
    } finally {
      setPulling(false);
    }
  }

  function handleLogout() {
    authStorage.clear();
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  async function handleStatusChange(status: "ONLINE" | "PAUSED") {
    if (status === attendantStatus || changingStatus) return;
    setChangingStatus(true);
    try {
      await api.post("/me/status", { status });
      dispatch(setAttendantStatus(status));
    } catch {
      toast.error("Não foi possível atualizar o status.");
    } finally {
      setChangingStatus(false);
    }
  }

  const waitingCount = waiting?.length ?? 0;

  return (
    <div className="bg-dot-grid flex h-screen">
      <aside className="bg-sidebar-gradient border-border flex w-72 shrink-0 flex-col border-r">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={fluxyLogo} alt="Fluxy" className="size-6 rounded-md" />
            <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">Fluxy Desk</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Histórico" onClick={() => navigate("/history")}>
              <History className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={handleLogout}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

        <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[attendantStatus])} />
            <span className="truncate text-sm font-medium">{userName ?? "Atendente"}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            {(["ONLINE", "PAUSED"] as const).map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={attendantStatus === status ? "default" : "outline"}
                disabled={changingStatus}
                onClick={() => handleStatusChange(status)}
              >
                {STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </div>

        <div className="border-border flex flex-col items-center gap-2 border-b p-4">
          <p className="text-muted-foreground flex items-baseline gap-1.5 text-sm">
            <span className="text-primary font-[family-name:var(--font-display)] text-2xl font-bold">{waitingCount}</span>
            ticket{waitingCount === 1 ? "" : "s"} aguardando
          </p>
          <Button className="h-10 w-full" disabled={waitingCount === 0 || pulling} onClick={handlePullNext}>
            {pulling ? "Puxando..." : "Puxar ticket"}
          </Button>
          {dispatchQueues.length > 0 && (
            <Button className="h-10 w-full" variant="outline" onClick={() => navigate("/dispatch/new")}>
              <Send className="size-4" /> Novo disparo
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="text-muted-foreground px-1 pt-1 pb-2 text-center text-xs font-medium tracking-wide uppercase">Meus tickets</p>
          <div className="flex flex-col gap-2">
            {mine?.map((ticket) => {
              const isUnread = unreadTicketIds.has(ticket.id);
              const isActive = activeTicketId === ticket.id;
              return (
                <button
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-md p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                    isActive ? "bg-gradient-to-br from-pink-500 to-purple-600 shadow-md" : "bg-neutral-200",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {isUnread && (
                        <span className={cn("size-2 shrink-0 rounded-full", isActive ? "bg-white" : "bg-primary")} aria-label="Mensagem não lida" />
                      )}
                      <span
                        className={cn(
                          "truncate text-sm",
                          isActive ? "text-white" : "text-foreground",
                          isUnread && !isActive ? "font-semibold" : "font-medium",
                        )}
                      >
                        {ticket.target?.name || ticket.target?.waId || "Contato"}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-[11px]", isActive ? "text-white" : "text-muted-foreground")}>
                      {formatTicketTime(ticket.lastMessageAt ?? ticket.updatedAt)}
                    </span>
                  </span>
                  <span className={cn("w-full truncate text-xs", isActive ? "text-white" : "text-muted-foreground")}>
                    {ticket.lastMessageText || "Sem mensagens ainda"}
                  </span>
                  <span className={cn("text-[11px]", isActive ? "text-white" : "text-muted-foreground")}>
                    #{ticket.ticketNumber} · {ticket.queue?.name}
                  </span>
                </button>
              );
            })}
            {mine && mine.length === 0 && (
              <p className="text-muted-foreground px-2 py-6 text-center text-xs">Nenhum ticket em atendimento.</p>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
