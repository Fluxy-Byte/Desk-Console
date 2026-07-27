import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import { clearSession } from "@/store/slices/auth-slice";
import type { Ticket } from "@/types/domain";

/// Shell no estilo WhatsApp: lista de tickets (contatos) fixa à esquerda,
/// conteúdo do ticket selecionado (chat + metadados) no <Outlet/>. Sem página
/// separada de "aguardando" — só o contador + botão que puxa o mais antigo.
export function DeskLayout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const activeTicketId = location.pathname.match(/^\/tickets\/([^/]+)/)?.[1];

  const [pulling, setPulling] = useState(false);

  const { data: waiting, mutate: mutateWaiting } = useSWR<Ticket[]>("/tickets?status=waiting");
  const { data: mine, mutate: mutateMine } = useSWR<Ticket[]>("/tickets?status=mine");

  useRealtimeEvent(() => {
    mutateWaiting();
    mutateMine();
  });

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

  const waitingCount = waiting?.length ?? 0;

  return (
    <div className="bg-dot-grid flex h-screen">
      <aside className="bg-sidebar-gradient border-border flex w-72 shrink-0 flex-col border-r">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">Desk</h1>
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={handleLogout}>
            <LogOut className="size-4" />
          </Button>
        </div>

        <div className="border-border flex flex-col items-center gap-2 border-b p-4">
          <p className="text-muted-foreground text-xs">
            {waitingCount} ticket{waitingCount === 1 ? "" : "s"} aguardando
          </p>
          <Button className="w-full" disabled={waitingCount === 0 || pulling} onClick={handlePullNext}>
            {pulling ? "Puxando..." : "Puxar ticket"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-muted-foreground px-4 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">Meus tickets</p>
          {mine?.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              className={cn(
                "hover:bg-sidebar-accent flex w-full flex-col items-start gap-0.5 border-b border-transparent px-4 py-3 text-left transition-colors",
                activeTicketId === ticket.id && "bg-sidebar-accent",
              )}
            >
              <span className="w-full truncate text-sm font-medium">
                {ticket.target?.name || ticket.target?.waId || "Contato"}
              </span>
              <span className="text-muted-foreground w-full truncate text-xs">
                #{ticket.ticketNumber} · {ticket.queue?.name}
              </span>
              <span className="text-muted-foreground text-[11px]">
                {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true, locale: ptBR })}
              </span>
            </button>
          ))}
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
