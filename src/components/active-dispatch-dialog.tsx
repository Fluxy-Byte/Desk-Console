import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DispatchTemplate, Queue, Target } from "@/types/domain";

interface ActiveDispatchDialogProps {
  queues: Queue[];
  trigger: React.ReactNode;
}

export function ActiveDispatchDialog({ queues, trigger }: ActiveDispatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [queueId, setQueueId] = useState("");
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQueue = queues.find((q) => q.id === queueId);
  const whatsappChannelId = selectedQueue?.serviceIsland?.whatsappChannelId;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: results } = useSWR<Target[]>(
    whatsappChannelId && contactMode === "existing" && debouncedSearch.length >= 2
      ? `/targets/search?whatsappChannelId=${whatsappChannelId}&q=${encodeURIComponent(debouncedSearch)}`
      : null,
  );

  const { data: templates } = useSWR<DispatchTemplate[]>(
    whatsappChannelId ? `/whatsapp-channels/${whatsappChannelId}/templates` : null,
  );

  function reset() {
    setQueueId("");
    setContactMode("existing");
    setSearch("");
    setDebouncedSearch("");
    setSelectedTarget(null);
    setNewPhone("");
    setNewName("");
    setTemplateName("");
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    const contact =
      contactMode === "existing"
        ? selectedTarget
          ? { phone: selectedTarget.waId, name: selectedTarget.name ?? undefined, email: selectedTarget.email ?? undefined }
          : null
        : newPhone.trim()
          ? { phone: newPhone.trim(), name: newName.trim() || undefined }
          : null;

    if (!queueId || !templateName || !contact) {
      setError("Preencha fila, contato e template.");
      return;
    }

    setSending(true);
    try {
      await api.post("/dispatch", { queueId, templateName, contact });
      toast.success("Disparo enviado.");
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível disparar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo disparo ativo</DialogTitle>
          <DialogDescription>
            Envia um template de WhatsApp para um contato — o ticket volta pra você, na fila escolhida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Fila</Label>
            <Select
              value={queueId}
              onValueChange={(v) => {
                setQueueId(v);
                setTemplateName("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma fila" />
              </SelectTrigger>
              <SelectContent>
                {queues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Contato</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={contactMode === "existing" ? "default" : "outline"}
                onClick={() => setContactMode("existing")}
              >
                Contato existente
              </Button>
              <Button
                type="button"
                size="sm"
                variant={contactMode === "new" ? "default" : "outline"}
                onClick={() => setContactMode("new")}
              >
                Novo número
              </Button>
            </div>

            {contactMode === "existing" ? (
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="Buscar por nome ou telefone…"
                  disabled={!queueId}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedTarget(null);
                  }}
                />
                {!queueId && <p className="text-muted-foreground text-xs">Escolha uma fila primeiro.</p>}
                {selectedTarget ? (
                  <div className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{selectedTarget.name || selectedTarget.waId}</span>
                    <button type="button" className="text-muted-foreground text-xs underline" onClick={() => setSelectedTarget(null)}>
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {results?.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTarget(t)}
                        className="hover:bg-accent rounded-md border px-3 py-2 text-left text-sm"
                      >
                        <p className="font-medium">{t.name || t.waId}</p>
                        {t.name && <p className="text-muted-foreground text-xs">{t.waId}</p>}
                      </button>
                    ))}
                    {debouncedSearch.length >= 2 && results && results.length === 0 && (
                      <p className="text-muted-foreground text-xs">Nenhum contato encontrado sem ticket aberto.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dispatch-phone" className="text-xs">
                    Telefone
                  </Label>
                  <Input id="dispatch-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dispatch-name" className="text-xs">
                    Nome (opcional)
                  </Label>
                  <Input id="dispatch-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={templateName} onValueChange={setTemplateName} disabled={!queueId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="button" disabled={sending} onClick={handleSubmit} className={cn("mt-2")}>
            {sending ? "Disparando…" : "Disparar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
