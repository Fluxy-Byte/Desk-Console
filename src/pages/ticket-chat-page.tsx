import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetadataEditor } from "@/components/metadata-editor";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { useRealtimeEvent } from "@/lib/realtime";
import { useAppSelector } from "@/store/hooks";
import type { MessageDocument, MessageType, Queue, TicketDetail } from "@/types/domain";

export function TicketChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAppSelector((s) => s.auth.user?.id);

  const { data: ticket, mutate, isLoading } = useSWR<TicketDetail>(id ? `/tickets/${id}` : null, {
    refreshInterval: 0,
  });
  const { data: queues } = useSWR<Queue[]>("/queues");

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [windowExpired, setWindowExpired] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Eco otimista: o envio só cria o documento no Mongo depois que o Outbound
  // Worker confirma o envio de verdade pra Meta (assíncrono, via fila) — sem
  // isso, o atendente mandaria uma mensagem e não veria nada acontecer até o
  // round-trip completo terminar. Cada mensagem enviada por aqui entra nesta
  // lista local e some assim que o histórico real (Mongo) cresce o
  // suficiente pra já contar como "reconciliada" (FIFO, mesma filosofia da
  // reconciliação server-side do Desk-Worker).
  const [pendingMessages, setPendingMessages] = useState<MessageDocument[]>([]);
  const lastHistoryLengthRef = useRef(0);

  useRealtimeEvent((event) => {
    if (event.type === "ticket_message" && event.ticketId === id) mutate();
    if (event.type === "ticket_updated" && event.ticketId === id) mutate();
  });

  useEffect(() => {
    const currentLength = ticket?.history.length ?? 0;
    const grew = currentLength - lastHistoryLengthRef.current;
    if (grew > 0 && pendingMessages.length > 0) {
      setPendingMessages((prev) => prev.slice(grew));
    }
    lastHistoryLengthRef.current = currentLength;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.history.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.history?.length, pendingMessages.length]);

  useEffect(() => {
    if (ticket?.messagingSession) {
      const elapsed = Date.now() - new Date(ticket.messagingSession.lastCustomerMessageAt).getTime();
      setWindowExpired(elapsed > 24 * 60 * 60 * 1000);
    }
  }, [ticket?.messagingSession]);

  async function sendMessage(input: { text: string; messageType?: MessageType; mediaUrl?: string }) {
    if (!id) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/messages`, input);
      setPendingMessages((prev) => [
        ...prev,
        {
          _id: `pending-${Date.now()}`,
          direction: "OUTBOUND",
          senderType: "ATTENDANT",
          messageType: input.messageType ?? "TEXT",
          text: input.text,
          mediaUrl: input.mediaUrl,
          createdAt: new Date().toISOString(),
        },
      ]);
      setText("");
      mutate();
    } catch (error) {
      if (error instanceof ApiError && error.code === "SESSION_WINDOW_EXPIRED") {
        setWindowExpired(true);
        toast.error("A janela de 24 horas foi encerrada para esta conversa.");
      } else {
        toast.error("Não foi possível enviar a mensagem.");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await sendMessage({ text: text.trim() });
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !id) return;

    setUploading(true);
    try {
      const { uploadUrl, mediaUrl } = await api.post<{ uploadUrl: string; mediaUrl: string }>("/uploads/presign", {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
      });

      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const messageType: MessageType = file.type.startsWith("image/")
        ? "IMAGE"
        : file.type.startsWith("audio/")
          ? "AUDIO"
          : "DOCUMENT";

      await sendMessage({ text: file.name, messageType, mediaUrl });
    } catch {
      toast.error("Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleClose() {
    if (!id) return;
    try {
      await api.post(`/tickets/${id}/close`);
      toast.success("Ticket encerrado.");
      navigate("/");
    } catch {
      toast.error("Não foi possível encerrar o ticket.");
    }
  }

  async function handleTransferQueue(queueId: string) {
    if (!id) return;
    try {
      await api.post(`/tickets/${id}/transfer-queue`, { queueId });
      toast.success("Ticket transferido para outra fila.");
      setTransferOpen(false);
      navigate("/");
    } catch {
      toast.error("Não foi possível transferir o ticket.");
    }
  }

  async function handleTransferAttendant(newUserId: string) {
    if (!id) return;
    try {
      await api.post(`/tickets/${id}/transfer-attendant`, { userId: newUserId });
      toast.success("Ticket transferido para outro atendente.");
      setTransferOpen(false);
      navigate("/");
    } catch {
      toast.error("Não foi possível transferir o ticket.");
    }
  }

  if (isLoading || !ticket) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  }

  const currentQueue = queues?.find((q) => q.id === ticket.queueId);
  const otherAttendants = currentQueue?.members?.filter((m) => m.userId !== userId) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border bg-background/80 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
        <div className="flex-1">
          <p className="text-sm font-semibold">{ticket.target?.name || ticket.target?.waId}</p>
          <p className="text-muted-foreground text-xs">
            Ticket #{ticket.ticketNumber} · {ticket.queue?.name}
          </p>
        </div>
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Transferir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transferir ticket</DialogTitle>
              <DialogDescription>Escolha uma fila ou um atendente da fila atual.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-xs">Transferir para fila</Label>
                <div className="mt-2 flex flex-col gap-2">
                  {queues?.filter((q) => q.id !== ticket.queueId).map((q) => (
                    <Button key={q.id} variant="outline" size="sm" onClick={() => handleTransferQueue(q.id)}>
                      {q.name}
                    </Button>
                  ))}
                  {!queues?.some((q) => q.id !== ticket.queueId) && (
                    <p className="text-muted-foreground text-xs">Nenhuma outra fila disponível para você.</p>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs">Transferir para atendente (mesma fila)</Label>
                <div className="mt-2 flex flex-col gap-2">
                  {otherAttendants.map((m) => (
                    <Button key={m.userId} variant="outline" size="sm" onClick={() => handleTransferAttendant(m.userId)}>
                      {m.user.name}
                    </Button>
                  ))}
                  {otherAttendants.length === 0 && (
                    <p className="text-muted-foreground text-xs">Nenhum outro atendente nesta fila.</p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="destructive" size="sm" onClick={handleClose}>
          Encerrar
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {ticket.history.length === 0 && pendingMessages.length === 0 && (
                <p className="text-muted-foreground py-8 text-center text-sm">Nenhuma mensagem ainda.</p>
              )}
              {ticket.history.map((msg) => (
                <MessageBubble key={msg._id} message={msg} />
              ))}
              {pendingMessages.map((msg) => (
                <MessageBubble key={msg._id} message={msg} pending />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-border bg-background border-t p-4">
            <div className="mx-auto max-w-2xl">
              {windowExpired ? (
                <p className="border-warning bg-warning/10 text-warning rounded-md border px-3 py-2 text-sm">
                  A janela de atendimento de 24 horas foi encerrada. É necessário um disparo ativo com template
                  aprovado pela Meta para reiniciar a conversa.
                </p>
              ) : (
                <form className="flex items-end gap-2" onSubmit={handleSubmit}>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                  <Textarea
                    className="min-h-10 flex-1 resize-none"
                    placeholder="Digite uma mensagem..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as unknown as FormEvent);
                      }
                    }}
                  />
                  <Button type="submit" size="icon" disabled={sending || !text.trim()}>
                    <Send className="size-4" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {ticket.target && (
          <div className="border-border w-80 shrink-0 overflow-y-auto border-l p-4">
            <MetadataEditor targetId={ticket.target.id} metadata={ticket.target.metadata} onUpdated={() => mutate()} />
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, pending }: { message: MessageDocument; pending?: boolean }) {
  const isCustomer = message.senderType === "CUSTOMER";

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${pending ? "opacity-60" : ""} ${
          isCustomer
            ? "bg-card border-border rounded-bl-sm border"
            : "bg-primary text-primary-foreground rounded-br-sm"
        }`}
      >
        <MessageContent message={message} />
        <p className={`mt-1 text-[10px] ${isCustomer ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
          {pending ? "enviando..." : format(new Date(message.createdAt), "HH:mm", { locale: ptBR })}
          {message.senderType === "SYSTEM" && " · sistema"}
          {message.senderType === "AGENT_AI" && " · IA"}
        </p>
      </div>
    </div>
  );
}

function MessageContent({ message }: { message: MessageDocument }) {
  if (message.messageType === "IMAGE" && message.mediaUrl) {
    return <img src={message.mediaUrl} alt={message.text || "Imagem"} className="max-w-full rounded-lg" />;
  }
  if (message.messageType === "AUDIO" && message.mediaUrl) {
    return <audio controls src={message.mediaUrl} className="max-w-full" />;
  }
  if (message.messageType === "DOCUMENT" && message.mediaUrl) {
    return (
      <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="underline">
        {message.text || "Documento"}
      </a>
    );
  }
  if ((message.messageType === "IMAGE" || message.messageType === "AUDIO" || message.messageType === "STICKER") && !message.mediaUrl) {
    return <Badge variant="outline">Mídia indisponível</Badge>;
  }
  return <p className="whitespace-pre-wrap">{message.text}</p>;
}
