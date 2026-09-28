// Confidence model.
//
// The score is a small weighted sum of things the app can actually observe:
// normalised BM25 score, query-term coverage in the cited passages, whether a
// tool call succeeded, and whether there is at least one citation. It is not a
// calibrated probability; the label is the useful output, and the threshold is a
// product decision the eval tab makes visible.

export const ANSWER_THRESHOLD = 0.62;
export const HIGH_CONFIDENCE = 0.8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function scoreConfidence({
  retrievalScore = 0,
  coverage = 0,
  toolCalls = [],
  citationCount = 0,
  missingOrderId = false,
}) {
  const retrieval = clamp(retrievalScore, 0, 1);
  const coverageScore = clamp(coverage, 0, 1);
  let score = 0.52 * retrieval + 0.4 * coverageScore + (citationCount > 0 ? 0.06 : 0);

  let toolDelta = 0;
  let successfulTools = 0;
  for (const call of toolCalls) {
    toolDelta += call.ok ? 0.16 : -0.12;
    if (call.ok) successfulTools += 1;
  }
  score += toolDelta;

  // A lookup that returned real order data is grounded regardless of how many
  // words of the question the help centre happens to match.
  if (successfulTools > 0) score = Math.max(score, 0.78);

  if (missingOrderId) score -= 0.12;
  if (!citationCount && !toolCalls.length) score -= 0.25;

  score = clamp(Number(score.toFixed(3)), 0.02, 0.98);
  const decision = score >= ANSWER_THRESHOLD ? "answer" : "escalate";
  const label = score >= HIGH_CONFIDENCE ? "high" : score >= ANSWER_THRESHOLD ? "medium" : "low";

  return {
    score,
    decision,
    label,
    threshold: ANSWER_THRESHOLD,
    components: {
      retrieval: Number(retrieval.toFixed(3)),
      coverage: Number(coverageScore.toFixed(3)),
      tools: Number(toolDelta.toFixed(3)),
      citations: citationCount,
    },
  };
}

export function shouldEscalate(score) {
  return score < ANSWER_THRESHOLD;
}

export function confidenceBand(score) {
  if (score >= HIGH_CONFIDENCE) return "high";
  if (score >= ANSWER_THRESHOLD) return "medium";
  return "low";
}
