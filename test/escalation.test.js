import test from "node:test";
import assert from "node:assert/strict";
import { createTicket, escalateConversation, ticketIdFor, transcriptText } from "../src/escalation.js";
import { DEMO_NOW } from "../src/tools.js";

function conversation() {
  return {
    id: "conv-1",
    customer: { name: "Maya Sharma", email: "maya@example.com", initials: "MS" },
    status: "resolved",
    ticket: null,
    messages: [
      { id: "m1", role: "customer", text: "Can you gift wrap this?", at: "2026-10-28T09:00:00" },
      {
        id: "m2",
        role: "agent",
        text: "I could not find a passage for that.",
        at: "2026-10-28T09:01:00",
        confidence: { score: 0.31 },
        citations: [],
      },
    ],
  };
}

test("ticket ids are stable from a sequence", () => {
  assert.equal(ticketIdFor(1), "TKT-1001");
  assert.equal(ticketIdFor(12), "TKT-1012");
});

test("a ticket records the transcript and the last confidence", () => {
  const ticket = createTicket({
    conversation: conversation(),
    reason: { text: "Agent confidence 31%", priority: "high" },
    sequence: 1,
    now: DEMO_NOW,
  });
  assert.equal(ticket.id, "TKT-1001");
  assert.equal(ticket.conversationId, "conv-1");
  assert.equal(ticket.priority, "high");
  assert.equal(ticket.status, "open");
  assert.equal(ticket.transcript.length, 2);
  assert.equal(ticket.transcript[0].role, "customer");
  assert.equal(ticket.confidence, 0.31);
  assert.match(ticket.subject, /gift wrap/);
  assert.ok(ticket.slaMinutes > 0);
});

test("escalating returns a new conversation with a ticket message", () => {
  const original = conversation();
  const escalated = escalateConversation(original, {
    reason: { text: "Out of scope", priority: "normal" },
    sequence: 2,
    now: DEMO_NOW,
  });
  assert.equal(original.ticket, null);
  assert.equal(escalated.status, "escalated");
  assert.equal(escalated.ticket.id, "TKT-1002");
  assert.equal(escalated.messages.length, 3);
  const handoff = escalated.messages.at(-1);
  assert.equal(handoff.role, "ticket");
  assert.equal(handoff.ticketId, "TKT-1002");
  assert.match(handoff.text, /Ticket TKT-1002/);
});

test("escalating twice is a no-op", () => {
  const escalated = escalateConversation(conversation(), { sequence: 3, now: DEMO_NOW });
  assert.equal(escalateConversation(escalated, { sequence: 4, now: DEMO_NOW }), escalated);
  assert.equal(escalated.ticket.id, "TKT-1003");
});

test("transcriptText renders a human-readable handoff", () => {
  const ticket = createTicket({ conversation: conversation(), sequence: 5, now: DEMO_NOW });
  const text = transcriptText(ticket);
  assert.match(text, /Customer: Can you gift wrap this\?/);
  assert.match(text, /Relay: I could not find/);
});
