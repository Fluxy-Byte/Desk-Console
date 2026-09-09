import { AlertCircle, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { MessageDocument } from "@/types/domain";

export function senderLabel(message: MessageDocument, attendantName?: string): string | null {
  if (message.senderType === "SYSTEM") return "Sistema";
  if (message.senderType === "AGENT_AI") return "IA";
  if (message.senderType === "ATTENDANT") return attendantName ?? "Atendente";
  return null;
}

export function MessageBubble({
  message,
  attendantName,
  pending,
}: {
  message: MessageDocument;
  attendantName?: string;
  pending?: boolean;
}) {
  const isCustomer = message.senderType === "CUSTOMER";
  const dateTime = format(new Date(message.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const sender = senderLabel(message, attendantName);

  return (
    <div className={`flex flex-col gap-1 ${isCustomer ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-lg ${pending ? "opacity-60" : ""} ${
          isCustomer
            ? "rounded-tl-none bg-muted text-foreground shadow-black/10"
            : "rounded-tr-none bg-primary text-primary-foreground shadow-primary/40"
        }`}
      >
        <MessageContent message={message} />
      </div>
      <p className="text-muted-foreground flex items-center gap-1 px-1 text-[10px]">
        {pending ? "enviando..." : dateTime}
        {!pending && sender && ` · ${sender}`}
        {!isCustomer && !pending && <MessageStatusTick status={message.waStatus} />}
      </p>
    </div>
  );
}

/// Tiques no estilo WhatsApp: 1 cinza = enviada, 2 cinza = entregue,
/// 2 azul = lida, alerta vermelho = falhou. Sem waStatus (mensagens de
/// sistema/antigas) não desenha nada.
export function MessageStatusTick({ status }: { status?: "sent" | "delivered" | "read" | "failed" }) {
  if (!status) return null;
  if (status === "failed") return <AlertCircle className="text-destructive size-3" />;
  if (status === "read") return <CheckCheck className="size-3 text-sky-400" />;
  if (status === "delivered") return <CheckCheck className="size-3 opacity-80" />;
  return <Check className="size-3 opacity-80" />;
}

export function MessageContent({ message }: { message: MessageDocument }) {
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
