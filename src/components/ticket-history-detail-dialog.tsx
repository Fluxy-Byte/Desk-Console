import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format-duration";
import type { TicketDetail } from "@/types/domain";

const TICKET_STATUS_LABELS: Record<string, string> = {
  WAITING: "Aguardando",
  IN_PROGRESS: "Em andamento",
  CLOSED: "Encerrado",
};

interface TicketHistoryDetailDialogProps {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
}

/// Mesmo layout 3 colunas do Agent Console (contato | conversa | detalhes),
/// trocando "Atendente" por detalhes do ticket já que aqui é sempre o próprio
/// atendente logado.
export function TicketHistoryDetailDialog({ ticketId, onOpenChange }: TicketHistoryDetailDialogProps) {
  const { data: ticket } = useSWR<TicketDetail>(ticketId ? `/tickets/${ticketId}` : null);

  return (
    <Dialog open={ticketId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden p-0">
        {!ticket ? (
          <div className="text-muted-foreground p-6 text-sm">Carregando…</div>
        ) : (
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>
                Ticket #{ticket.ticketNumber} · {ticket.queue?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_1fr_220px]">
              <div className="border-border flex flex-col gap-3 border-b p-4 md:border-r md:border-b-0">
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Contato</h3>
                <div>
                  <p className="text-sm font-medium">{ticket.target?.name || "Sem nome"}</p>
                  <p className="text-muted-foreground text-xs">{ticket.target?.waId}</p>
                  {ticket.target?.email && <p className="text-muted-foreground text-xs">{ticket.target.email}</p>}
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-y-auto p-4">
                <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Conversa</h3>
                <div className="flex flex-col gap-2">
                  {ticket.history.map((message) => (
                    <div
                      key={message._id}
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.direction === "OUTBOUND" ? "bg-primary/10 self-end" : "bg-muted self-start"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text || `[${message.messageType}]`}</p>
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        {new Date(message.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                  {ticket.history.length === 0 && (
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem encontrada.</p>
                  )}
                </div>
              </div>

              <div className="border-border flex flex-col gap-3 border-t p-4 md:border-t-0 md:border-l">
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Detalhes</h3>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fila</span>
                    <span>{ticket.queue?.name ?? "—"}</span>
                  </div>
                  {ticket.closeTag && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tag de fechamento</span>
                      <span>{ticket.closeTag.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tempo de espera</span>
                    <span>{formatDuration(ticket.waitDurationMs)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duração do atendimento</span>
                    <span>{formatDuration(ticket.handlingDurationMs)}</span>
                  </div>
                  {ticket.closedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Encerrado em</span>
                      <span>{new Date(ticket.closedAt).toLocaleString("pt-BR")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
