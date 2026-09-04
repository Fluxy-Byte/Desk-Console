import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration } from "@/lib/format-duration";
import { TicketHistoryDetailDialog } from "@/components/ticket-history-detail-dialog";
import type { TicketListResult } from "@/types/domain";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function TicketHistoryPage() {
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const params = new URLSearchParams({ status: "closed", page: String(page), pageSize: String(pageSize) });
  if (phone.trim()) params.set("phone", phone.trim());
  if (date) params.set("date", date);
  if (ticketNumber.trim()) params.set("ticketNumber", ticketNumber.trim());

  const { data: result } = useSWR<TicketListResult>(`/tickets?${params.toString()}`);
  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="w-fit gap-2 px-2">
        <ArrowLeft className="size-4" /> Voltar
      </Button>

      <div className="border-border bg-card rounded-lg border p-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Meu histórico de atendimentos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tickets que você já encerrou.</p>
      </div>

      <div className="border-border bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="history-phone" className="text-xs">
            Telefone
          </Label>
          <Input
            id="history-phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              resetToFirstPage();
            }}
            placeholder="5511999999999"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="history-date" className="text-xs">
            Data de encerramento
          </Label>
          <Input
            id="history-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              resetToFirstPage();
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="history-ticket-number" className="text-xs">
            Id do ticket
          </Label>
          <Input
            id="history-ticket-number"
            type="number"
            value={ticketNumber}
            onChange={(e) => {
              setTicketNumber(e.target.value);
              resetToFirstPage();
            }}
            placeholder="123"
          />
        </div>
      </div>

      <div className="border-border bg-card flex min-w-0 flex-1 flex-col rounded-lg border">
        {!result ? (
          <div className="text-muted-foreground p-6 text-sm">Carregando…</div>
        ) : result.items.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center text-sm">Nenhum ticket encerrado encontrado.</div>
        ) : (
          <div className="flex flex-col">
            {result.items.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
                className="hover:bg-accent border-border flex flex-col gap-1 border-b px-4 py-3 text-left last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{ticket.target?.name || ticket.target?.waId || "Contato"}</span>
                  <Badge variant="outline">#{ticket.ticketNumber}</Badge>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <span>{ticket.queue?.name}</span>
                  <span>Espera: {formatDuration(ticket.waitDurationMs)}</span>
                  <span>Duração: {formatDuration(ticket.handlingDurationMs)}</span>
                  {ticket.closedAt && <span>Encerrado em {new Date(ticket.closedAt).toLocaleString("pt-BR")}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {result && result.total > 0 && (
          <div className="border-border mt-auto flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Itens por página</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger size="sm" className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <TicketHistoryDetailDialog ticketId={selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)} />
    </div>
  );
}
