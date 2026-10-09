import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_NAME, answerQuestion, createAgent, stripOrderIds } from "../src/agent.js";
import { ANSWER_THRESHOLD, HIGH_CONFIDENCE, scoreConfidence, shouldEscalate } from "../src/confidence.js";

const agent = createAgent();

test("a refund question calls the refund tool and cites the eligibility article", () => {
  const answer = answerQuestion(agent, "Is LM-1042 eligible for a refund?");
  assert.equal(answer.role, "agent");
  assert.equal(answer.agent, AGENT_NAME);
  assert.equal(answer.decision, "answer");
  assert.equal(answer.toolCalls.length, 1);
  assert.equal(answer.toolCalls[0].name, "refund_eligibility");
  assert.equal(answer.toolCalls[0].ok, true);
  assert.equal(answer.retrieval[0].articleId, "kb-refund-eligibility");
  assert.ok(answer.citations.length >= 1);
  assert.match(answer.text, /\[1\]/);
  assert.match(answer.text, /NPR 5,340/);
  assert.ok(answer.confidence.score >= ANSWER_THRESHOLD);
});

test("an order status question is grounded in the lookup result and a passage", () => {
  const answer = answerQuestion(agent, "Where is my order LM-1042?");
  assert.equal(answer.toolCalls[0].name, "lookup_order");
  assert.equal(answer.toolCalls[0].ok, true);
  assert.match(answer.text, /Delivered on 20 Oct 2026/);
  assert.match(answer.text, /NP884120045/);
  assert.ok(answer.citations.length > 0);
  assert.equal(answer.decision, "answer");
});

test("a specific question without an order number asks for one", () => {
  const answer = answerQuestion(agent, "Where is my order?");
  assert.equal(answer.decision, "clarify");
  assert.equal(answer.toolCalls.length, 0);
  assert.match(answer.text, /order number/);
  assert.ok(answer.confidence.score < HIGH_CONFIDENCE);
  assert.ok(answer.citations.length > 0); // still explains how to check
});

test("an out-of-scope request escalates instead of inventing an answer", () => {
  const answer = answerQuestion(agent, "Can you gift-wrap my order in recycled paper and add a handwritten note?");
  assert.equal(answer.decision, "escalate");
  assert.ok(answer.confidence.score < ANSWER_THRESHOLD);
  assert.equal(shouldEscalate(answer.confidence.score), true);
});

test("the same question produces the same answer twice", () => {
  const a = answerQuestion(agent, "Do you ship to Bhutan?");
  const b = answerQuestion(agent, "Do you ship to Bhutan?");
  assert.deepEqual(a, b);
});

test("citations carry a title and a non-empty quoted snippet", () => {
  const answer = answerQuestion(agent, "How do I reset my password?");
  assert.ok(answer.citations.length > 0);
  for (const citation of answer.citations) {
    assert.ok(citation.articleId.startsWith("kb-"));
    assert.ok(citation.title.length > 3);
    assert.ok(citation.snippet.length > 20);
    assert.ok(citation.index >= 1);
  }
});

test("stripOrderIds removes the identifier but keeps the question", () => {
  assert.equal(stripOrderIds("Where is my order LM-1042 please?"), "Where is my order please?");
  assert.equal(stripOrderIds("LM 1042"), "");
});

test("confidence thresholds behave at the boundary", () => {
  const high = scoreConfidence({ retrievalScore: 0.9, coverage: 0.9, citationCount: 2 });
  assert.equal(high.decision, "answer");
  assert.equal(high.label, "high");
  assert.ok(high.score >= HIGH_CONFIDENCE);

  const low = scoreConfidence({ retrievalScore: 0.1, coverage: 0.1, citationCount: 0 });
  assert.equal(low.decision, "escalate");
  assert.equal(low.label, "low");
  assert.equal(shouldEscalate(low.score), true);
});

test("a successful tool result is treated as strong evidence", () => {
  const withTool = scoreConfidence({
    retrievalScore: 0.05, coverage: 0, citationCount: 1,
    toolCalls: [{ name: "lookup_order", ok: true }],
  });
  assert.ok(withTool.score >= 0.78);
  assert.equal(withTool.decision, "answer");

  const failedTool = scoreConfidence({
    retrievalScore: 0.6, coverage: 0.6, citationCount: 1,
    toolCalls: [{ name: "lookup_order", ok: false }],
  });
  assert.ok(failedTool.score < 0.62);
});

test("missing order numbers reduce confidence", () => {
  const base = scoreConfidence({ retrievalScore: 0.8, coverage: 0.7, citationCount: 1 });
  const missing = scoreConfidence({ retrievalScore: 0.8, coverage: 0.7, citationCount: 1, missingOrderId: true });
  assert.ok(missing.score < base.score);
  assert.ok(missing.components.tools === 0);
});
