import test from "node:test";
import assert from "node:assert/strict";
import { average, confidenceBuckets, percentile, summariseConversations } from "../src/metrics.js";

function conversation(id, { ticket = null, firstResponseMs = 500, score = 0.8, tools = 0, citations = 1 } = {}) {
  const messages = [
    { role: "customer", text: "Question", at: "2026-10-28T09:00:00" },
    {
      role: "agent", text: "Answer", at: "2026-10-28T09:01:00",
      confidence: { score },
      toolCalls: Array.from({ length: tools }, () => ({ name: "lookup_order", ok: true })),
      citations: Array.from({ length: citations }, (_, index) => ({ index: index + 1 })),
    },
  ];
  if (ticket) {
    messages.push({ role: "ticket", text: "Handed off", ticketId: ticket });
  }
  return { id, messages, firstResponseMs, ticket: ticket ? { id: ticket, status: "open" } : null };
}

test("percentile uses the nearest-rank method", () => {
  assert.equal(percentile([100, 200, 300], 50), 200);
  assert.equal(percentile([100, 200, 300], 95), 300);
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([42], 95), 42);
});

test("average ignores non-finite values", () => {
  assert.equal(average([2, 4, 6]), 4);
  assert.equal(average([2, null, undefined, 4]), 3);
  assert.equal(average([]), 0);
});

test("summariseConversations derives deflection, escalation and latency", () => {
  const conversations = [
    conversation("a", { firstResponseMs: 400, score: 0.9, tools: 1, citations: 2 }),
    conversation("b", { firstResponseMs: 600, score: 0.7 }),
    conversation("c", { firstResponseMs: 200, score: 0.4, ticket: "TKT-1001" }),
    conversation("d", { firstResponseMs: 800, score: 0.5, ticket: "TKT-1002" }),
  ];
  const summary = summariseConversations(conversations);
  assert.equal(summary.total, 4);
  assert.equal(summary.resolved, 2);
  assert.equal(summary.escalated, 2);
  assert.equal(summary.deflectionRate, 0.5);
  assert.equal(summary.escalationRate, 0.5);
  assert.equal(summary.avgFirstResponseMs, 500);
  assert.equal(summary.p95FirstResponseMs, 800);
  assert.equal(summary.toolCalls, 1);
  assert.equal(summary.citations, 5);
  assert.equal(summary.openTickets, 2);
  assert.ok(Math.abs(summary.avgConfidence - 0.625) < 1e-9);
});

test("empty conversation lists do not divide by zero", () => {
  const summary = summariseConversations([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.deflectionRate, 0);
  assert.equal(summary.avgFirstResponseMs, 0);
});

test("confidence buckets match the labels used in the UI", () => {
  const buckets = confidenceBuckets([
    conversation("a", { score: 0.9 }),
    conversation("b", { score: 0.7 }),
    conversation("c", { score: 0.3 }),
    conversation("d", { score: 0.5 }),
  ]);
  assert.deepEqual(buckets, { high: 1, medium: 1, low: 2 });
});
