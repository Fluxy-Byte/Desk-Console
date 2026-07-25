import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { useRealtimeEvent } from "@/lib/realtime";
import { useAppDispatch } from "@/store/hooks";
import { clearSession } from "@/store/slices/auth-slice";
import { authStorage } from "@/lib/auth-storage";
import type { Ticket } from "@/types/domain";

type Tab = "waiting" | "mine";

export function QueueBoardPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("waiting");
  const [pulling, setPulling] = useState<string | null>(null);

  const { data: tickets, mutate } = useSWR<Ticket[]>(`/tickets?status=${tab}`);

  useRealtimeEvent(() => {
    // ticket_new / ticket_updated — qualquer atividade revalida o board.
    mutate();
  });

  async function handlePull(ticketId: string) {
    setPulling(ticketId);
    try {
      await api.post(`/tickets/${ticketId}/pull`);
      navigate(`/tickets/${ticketId}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "TICKET_ALREADY_TAKEN") {
        toast.error("Este ticket já foi puxado por outro atendente.");
        mutate();
      } else {
        toast.error("Não foi possível puxar o ticket.");
      }
    } finally {
      setPulling(null);
    }
  }

  function handleLogout() {
    authStorage.clear();
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  return (
    <div className="bg-dot-grid min-h-screen p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Fila de atendimento</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>

        <div className="border-border flex gap-1 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium ${tab === "waiting" ? "border-primary text-primary border-b-2" : "text-muted-foreground"}`}
            onClick={() => setTab("waiting")}
          >
            Aguardando
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${tab === "mine" ? "border-primary text-primary border-b-2" : "text-muted-foreground"}`}
            onClick={() => setTab("mine")}
          >
            Meus tickets
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {tickets?.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {ticket.target?.name || ticket.target?.waId || "Contato"}
                    <span className="text-muted-foreground ml-2 text-xs font-normal">#{ticket.ticketNumber}</span>
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {ticket.queue?.name} ·{" "}
                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {tab === "waiting" ? (
                  <Button size="sm" disabled={pulling === ticket.id} onClick={() => handlePull(ticket.id)}>
                    {pulling === ticket.id ? "Puxando..." : "Puxar"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    Abrir
                  </Button>
                )}
              </CardHeader>
            </Card>
          ))}

          {tickets && tickets.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                {tab === "waiting" ? "Nenhum ticket aguardando." : "Você não tem tickets em atendimento."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
