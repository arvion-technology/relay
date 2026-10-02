// Conversation metrics. Everything is derived from the conversation records the
// demo builds; there are no hard-coded rates anywhere in the UI.

export function percentile(values, p) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function lastAgentMessage(conversation) {
  return [...conversation.messages].reverse().find((message) => message.role === "agent") || null;
}

export function summariseConversations(conversations) {
  const total = conversations.length;
  const escalated = conversations.filter((conversation) => Boolean(conversation.ticket)).length;
  const resolved = total - escalated;
  const firstResponses = conversations
    .map((conversation) => conversation.firstResponseMs)
    .filter((value) => Number.isFinite(value));
  const confidences = conversations
    .map((conversation) => lastAgentMessage(conversation)?.confidence?.score)
    .filter((value) => Number.isFinite(value));
  const toolCalls = conversations.reduce((sum, conversation) => (
    sum + conversation.messages.reduce((inner, message) => inner + (message.toolCalls?.length || 0), 0)
  ), 0);
  const citations = conversations.reduce((sum, conversation) => (
    sum + conversation.messages.reduce((inner, message) => inner + (message.citations?.length || 0), 0)
  ), 0);

  return {
    total,
    resolved,
    escalated,
    deflectionRate: total ? resolved / total : 0,
    escalationRate: total ? escalated / total : 0,
    avgFirstResponseMs: Math.round(average(firstResponses)),
    p50FirstResponseMs: Math.round(percentile(firstResponses, 50)),
    p95FirstResponseMs: Math.round(percentile(firstResponses, 95)),
    avgConfidence: confidences.length ? average(confidences) : 0,
    toolCalls,
    citations,
    openTickets: conversations.filter((conversation) => conversation.ticket?.status === "open").length,
  };
}

export function confidenceBuckets(conversations) {
  const buckets = { high: 0, medium: 0, low: 0 };
  for (const conversation of conversations) {
    const score = lastAgentMessage(conversation)?.confidence?.score;
    if (!Number.isFinite(score)) continue;
    if (score >= 0.8) buckets.high += 1;
    else if (score >= 0.62) buckets.medium += 1;
    else buckets.low += 1;
  }
  return buckets;
}
