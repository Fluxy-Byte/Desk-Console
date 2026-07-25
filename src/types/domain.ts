export type TicketStatus = "WAITING" | "IN_PROGRESS" | "CLOSED";
export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" | "STICKER";

export interface Queue {
  id: string;
  serviceIslandId: string;
  name: string;
  members?: { id: string; userId: string; user: { id: string; name: string; email: string } }[];
}

export interface Target {
  id: string;
  waId: string;
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MessagingSession {
  id: string;
  lastCustomerMessageAt: string;
  lastAttendantMessageAt: string | null;
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
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  history: MessageDocument[];
}
