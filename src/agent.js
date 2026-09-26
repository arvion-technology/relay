// The agent loop: retrieve, plan tools, compose, score confidence, decide.
//
// There is no language model. Every step is deterministic and inspectable, which
// is the point of the demo: the trace panel can show exactly which passages and
// tool results produced the reply.

import { HELP_CENTRE } from "./corpus.js";
import { buildIndex, normalizeScore, search } from "./retrieval.js";
import { DEMO_NOW, SAMPLE_ORDERS, executePlan, planTools } from "./tools.js";
import { composeAnswer } from "./composer.js";
import { scoreConfidence } from "./confidence.js";

export const AGENT_NAME = "Relay";

export function createAgent({ articles = HELP_CENTRE, orders = SAMPLE_ORDERS, now = DEMO_NOW } = {}) {
  return { articles, orders, now, index: buildIndex(articles) };
}

export function stripOrderIds(message) {
  return String(message || "")
    .replace(/\bLM[-\s]?\d{3,5}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Run one turn. The returned object is the agent message the UI appends to the
 * transcript, plus the retrieval trace the operator panel renders.
 */
export function answerQuestion(agent, message, { history = [] } = {}) {
  const queryText = stripOrderIds(message) || String(message || "");
  const results = search(agent.index, message, { limit: 5 });
  const plan = planTools(message, { orders: agent.orders });
  const toolCalls = executePlan(plan, { orders: agent.orders, now: agent.now });
  const missingOrderId = plan.missing.includes("orderId");
  const composed = composeAnswer({ queryText, results, toolCalls, missingOrderId });
  const confidence = scoreConfidence({
    retrievalScore: normalizeScore(results[0]?.score || 0),
    coverage: composed.coverage,
    toolCalls,
    citationCount: composed.citations.length,
    missingOrderId,
  });

  const decision = missingOrderId ? "clarify" : confidence.decision;
  const latencyMs = Math.round(
    220 + composed.text.length * 2.4 + toolCalls.reduce((sum, call) => sum + call.latencyMs, 0),
  );

  return {
    role: "agent",
    agent: AGENT_NAME,
    text: composed.text,
    citations: composed.citations,
    toolCalls,
    confidence: { ...confidence, decision },
    decision,
    intent: plan.intent,
    retrieval: results.map((result) => ({
      articleId: result.article.id,
      title: result.article.title,
      category: result.article.category,
      score: Number(result.score.toFixed(3)),
      normalized: Number(normalizeScore(result.score).toFixed(3)),
    })),
    latencyMs,
    historyTurns: history.length,
  };
}

export function customerMessage(text, { at = null, id = null } = {}) {
  return { id, role: "customer", text, at };
}
