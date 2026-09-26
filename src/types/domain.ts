export type TicketStatus = "WAITING" | "IN_PROGRESS" | "CLOSED";
export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" | "STICKER" | "VIDEO";

export interface Queue {
  id: string;
  serviceIslandId: string;
  name: string;
  members?: { id: string; userId: string; user: { id: string; name: string; email: string } }[];
  serviceIsland?: {
    id: string;
    allowActiveDispatch: boolean;
    allowAudioMessages?: boolean;
    /// Só vem em GET /tickets/:id — libera o botão "Carteiras" do contato.
    allowAttendantCarteira?: boolean;
    whatsappChannelId: string;
  };
}

/// GET /tickets/:id/carteiras — carteiras da ilha do ticket, `checked` = o
/// contato já está nela.
export interface TicketCarteira {
  id: string;
  name: string;
  checked: boolean;
  queue: { id: string; name: string };
}

export interface Target {
  id: string;
  waId: string;
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  buttons?: { type: string; text: string }[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: TemplateComponent[];
  variableCount: { header: number; body: number };
}

export interface MessagingSession {
  id: string;
  lastCustomerMessageAt: string;
  lastAttendantMessageAt: string | null;
}

export interface TicketCloseTag {
  id: string;
  name: string;
}

export interface PreConfiguredMessage {
  id: string;
  name: string;
  content: string;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  status: TicketStatus;
  queueId: string;
  queue?: Queue;
  targetId: string;
  target?: Target;
  messagingSessionId: string;
  messagingSession?: MessagingSession;
  assignedUserId: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  closeTag?: TicketCloseTag | null;
  waitDurationMs?: number | null;
  handlingDurationMs?: number | null;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
}

export interface TicketListResult {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: "CUSTOMER" | "ATTENDANT" | "SYSTEM";
  senderUserId: string | null;
  mongoMessageId: string | null;
  messageType: MessageType;
  createdAt: string;
}

export interface MessageDocument {
  _id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CUSTOMER" | "AGENT_AI" | "ATTENDANT" | "SYSTEM";
  messageType: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  waStatus?: "sent" | "delivered" | "read" | "failed";
  createdAt: string;
}

export interface RelatedTicket {
  id: string;
  ticketNumber: number;
  createdAt: string;
  closedAt: string | null;
  assignedUser: { name: string } | null;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  history: MessageDocument[];
  relatedTickets: RelatedTicket[];
}
