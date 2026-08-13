import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut, Send } from "lucide-react";
import { toast } from "sonner";
import fluxyLogo from "@/assets/Logo.png";
import { ActiveDispatchDialog } from "@/components/active-dispatch-dialog";
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
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={handleLogout}>
            <LogOut className="size-4" />
          </Button>
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
          <p className="text-muted-foreground text-xs">
            {waitingCount} ticket{waitingCount === 1 ? "" : "s"} aguardando
          </p>
          <Button className="w-full" disabled={waitingCount === 0 || pulling} onClick={handlePullNext}>
            {pulling ? "Puxando..." : "Puxar ticket"}
          </Button>
          {dispatchQueues.length > 0 && (
            <ActiveDispatchDialog
              queues={dispatchQueues}
              trigger={
                <Button className="w-full" variant="outline">
                  <Send className="size-4" /> Novo disparo
                </Button>
              }
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-muted-foreground px-4 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">Meus tickets</p>
          {mine?.map((ticket) => {
            const isUnread = unreadTicketIds.has(ticket.id);
            return (
              <button
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className={cn(
                  "hover:bg-sidebar-accent flex w-full flex-col items-start gap-0.5 border-b border-transparent px-4 py-3 text-left transition-colors",
                  activeTicketId === ticket.id && "bg-sidebar-accent",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  {isUnread && (
                    <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Mensagem não lida" />
                  )}
                  <span className={cn("truncate text-sm", isUnread ? "text-foreground font-semibold" : "font-medium")}>
                    {ticket.target?.name || ticket.target?.waId || "Contato"}
                  </span>
                </span>
                <span className="text-muted-foreground w-full truncate text-xs">
                  #{ticket.ticketNumber} · {ticket.queue?.name}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true, locale: ptBR })}
                </span>
              </button>
            );
          })}
          {mine && mine.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-xs">Nenhum ticket em atendimento.</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
