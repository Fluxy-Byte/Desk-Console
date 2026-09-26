import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Save, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import type { TicketCarteira } from "@/types/domain";

/// Botão + modal "Carteiras" do painel do contato — só aparece quando a ilha
/// do ticket liberou (ServiceIsland.allowAttendantCarteira). Lista as
/// carteiras da ilha com checkbox; salvar manda a lista completa marcada.
export function CarteirasDialog({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const { data: carteiras, mutate } = useSWR<TicketCarteira[]>(open ? `/tickets/${ticketId}/carteiras` : null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (carteiras) setSelected(new Set(carteiras.filter((c) => c.checked).map((c) => c.id)));
  }, [carteiras]);

  function toggle(carteiraId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(carteiraId)) next.delete(carteiraId);
      else next.add(carteiraId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.patch<TicketCarteira[]>(`/tickets/${ticketId}/carteiras`, {
        carteiraIds: [...selected],
      });
      await mutate(updated, { revalidate: false });
      toast.success("Carteiras do contato atualizadas.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar as carteiras.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <WalletCards className="size-4" /> Adicionar a carteira
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carteiras de atendimento</DialogTitle>
          <DialogDescription>
            Marque as carteiras deste contato. Nos próximos atendimentos ele vai direto para a fila da carteira.
          </DialogDescription>
        </DialogHeader>

        {!carteiras ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : carteiras.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma carteira cadastrada nesta ilha.</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {carteiras.map((carteira) => (
              <label
                key={carteira.id}
                className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={selected.has(carteira.id)}
                  onChange={() => toggle(carteira.id)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{carteira.name}</p>
                  <p className="text-muted-foreground truncate text-xs">Fila {carteira.queue.name}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {carteiras && carteiras.length > 0 && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
