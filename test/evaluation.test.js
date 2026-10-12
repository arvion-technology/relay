import test from "node:test";
import assert from "node:assert/strict";
import { createAgent } from "../src/agent.js";
import { LABELLED_QUESTIONS, runEvaluation } from "../src/evaluation.js";
import { seedConversations } from "../src/conversations.js";
import { summariseConversations } from "../src/metrics.js";

const agent = createAgent();

test("the labelled set covers retrieval, tools and escalation", () => {
  assert.equal(LABELLED_QUESTIONS.length, 15);
  assert.ok(LABELLED_QUESTIONS.filter((question) => question.expectedTool).length >= 3);
  assert.ok(LABELLED_QUESTIONS.some((question) => question.expectedEscalate));
  assert.ok(LABELLED_QUESTIONS.some((question) => !question.expectedEscalate));
});

test("the evaluation computes retrieval, tool, grounding and escalation metrics", () => {
  const result = runEvaluation(agent);
  assert.equal(result.total, 15);
  assert.equal(result.retrievalCases, 13);
  assert.equal(result.hitAt1, 1);
  assert.equal(result.hitAt3, 1);
  assert.equal(result.mrr, 1);
  assert.equal(result.toolAccuracy, 1);
  assert.equal(result.escalationAccuracy, 1);
  assert.equal(result.groundingRate, 1);
  assert.equal(result.passedRate, 1);
  assert.equal(result.rows.length, 15);
  assert.ok(result.toolCases >= 3);
});

test("out-of-scope questions escalate and are not scored for retrieval", () => {
  const outOfScope = runEvaluation(agent, LABELLED_QUESTIONS.filter((question) => question.expectedEscalate));
  assert.equal(outOfScope.total, 2);
  assert.equal(outOfScope.rows.every((row) => row.escalated), true);
  assert.equal(outOfScope.rows.every((row) => row.hit1 === null), true);
  assert.equal(outOfScope.groundingRate, 0); // no answered rows to ground
});

test("every labelled row carries the answer and confidence it produced", () => {
  const result = runEvaluation(agent);
  for (const row of result.rows) {
    assert.ok(row.answer);
    assert.ok(row.answer.text.length > 0);
    assert.ok(Number.isFinite(row.confidence));
    assert.ok(row.confidence > 0 && row.confidence <= 1);
    assert.ok(["answer", "clarify", "escalate"].includes(row.decision));
  }
});

test("the seeded log produces consistent metrics", () => {
  const conversations = seedConversations(agent);
  const summary = summariseConversations(conversations);
  assert.equal(summary.total, 10);
  assert.equal(summary.escalated, 2);
  assert.equal(summary.resolved, 8);
  assert.equal(summary.deflectionRate, 0.8);
  assert.equal(summary.openTickets, 2);
  assert.ok(summary.avgConfidence > 0.6);
  assert.ok(summary.p95FirstResponseMs >= summary.p50FirstResponseMs);
});
