import test from "node:test";
import assert from "node:assert/strict";
import { createAgent } from "../src/agent.js";
import { seedConversations } from "../src/conversations.js";
import { lastAgentMessage } from "../src/metrics.js";

const agent = createAgent();

test("the conversation log is deterministic", () => {
  assert.deepEqual(seedConversations(agent), seedConversations(agent));
});

test("the seed contains ten conversations and two hand-offs", () => {
  const conversations = seedConversations(agent);
  assert.equal(conversations.length, 10);
  const escalated = conversations.filter((conversation) => conversation.ticket);
  assert.equal(escalated.length, 2);
  assert.deepEqual(escalated.map((conversation) => conversation.ticket.id), ["TKT-1001", "TKT-1002"]);
});

test("every conversation contains an agent answer with a confidence score", () => {
  for (const conversation of seedConversations(agent)) {
    const agentMessage = lastAgentMessage(conversation);
    assert.ok(agentMessage, `${conversation.id} has no agent message`);
    assert.ok(agentMessage.text.length > 0);
    assert.ok(Number.isFinite(agentMessage.confidence.score));
    assert.ok(conversation.customer.name.length > 0);
    assert.ok(conversation.firstResponseMs > 0);
  }
});

test("escalated tickets include the full transcript", () => {
  const escalated = seedConversations(agent).filter((conversation) => conversation.ticket);
  assert.ok(escalated.length > 0);
  for (const conversation of escalated) {
    assert.equal(conversation.status, "escalated");
    assert.ok(conversation.ticket.transcript.length >= 2);
    assert.equal(conversation.ticket.conversationId, conversation.id);
    assert.equal(conversation.messages.at(-1).role, "ticket");
  }
});

test("the first conversation has a resolved follow-up", () => {
  const [first] = seedConversations(agent);
  assert.equal(first.id, "conv-4112");
  assert.equal(first.ticket, null);
  assert.equal(first.messages.length, 4);
  assert.ok(first.messages[2].text.includes("LM-1042"));
  assert.equal(first.messages[3].toolCalls[0].name, "refund_eligibility");
});
