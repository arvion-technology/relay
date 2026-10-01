// Human hand-off. A ticket is built from the conversation transcript so the
// customer never has to repeat themselves, and the reason is kept alongside the
// confidence score the agent had when it gave up.

import { DEMO_NOW } from "./tools.js";

export const DEFAULT_QUEUE = "Tier 1 · General";

export function ticketIdFor(sequence) {
  return `TKT-${1000 + Math.max(1, Math.floor(sequence))}`;
}

export function createTicket({ conversation, reason = "Low confidence", sequence = 1, now = DEMO_NOW, queue = DEFAULT_QUEUE } = {}) {
  const customerMessages = conversation.messages.filter((message) => message.role === "customer");
  const lastQuestion = customerMessages.at(-1)?.text
    || "Support request";
  const lastAgent = [...conversation.messages].reverse().find((message) => message.role === "agent");
  const transcript = conversation.messages
    .filter((message) => message.role !== "ticket")
    .map((message) => ({ role: message.role, text: message.text, at: message.at }));

  return {
    id: ticketIdFor(sequence),
    conversationId: conversation.id,
    customer: conversation.customer,
    subject: lastQuestion.length > 84 ? `${lastQuestion.slice(0, 83)}…` : lastQuestion,
    queue,
    priority: reason.priority || "normal",
    status: "open",
    createdAt: `${now}T10:05:00`,
    slaMinutes: 15,
    reason: reason.text || reason,
    confidence: lastAgent?.confidence?.score ?? null,
    transcript,
    messageCount: transcript.length,
  };
}

export function escalateConversation(conversation, { reason = "Low confidence", sequence = 1, now = DEMO_NOW, queue } = {}) {
  if (conversation.ticket) return conversation;
  const ticket = createTicket({ conversation, reason, sequence, now, queue });
  const handoff = {
    id: `${conversation.id}-ticket`,
    role: "ticket",
    at: `${now}T10:05:00`,
    text: `Handed off to a human. Ticket ${ticket.id} was created with this transcript.`,
    ticketId: ticket.id,
    ticket,
  };
  return {
    ...conversation,
    status: "escalated",
    ticket,
    messages: [...conversation.messages, handoff],
  };
}

export function transcriptText(ticket) {
  return ticket.transcript
    .map((entry) => `${entry.role === "customer" ? "Customer" : "Relay"}: ${entry.text}`)
    .join("\n\n");
}
