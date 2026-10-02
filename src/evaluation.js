// Evaluation harness over labelled questions.
//
// The labels live next to the questions so the numbers in the admin tab are
// reproducible: hit@k measures retrieval, grounding checks that the cited
// article is the labelled one, tool accuracy checks the planner, and escalation
// accuracy checks the confidence threshold against an expected hand-off.

import { answerQuestion, createAgent } from "./agent.js";

export const LABELLED_QUESTIONS = [
  {
    id: "q-01", question: "Where is my order LM-1048?",
    expectedArticles: ["kb-order-status", "kb-order-tracking"], expectedTool: "lookup_order", expectedEscalate: false,
  },
  {
    id: "q-02", question: "How long does standard delivery take?",
    expectedArticles: ["kb-delivery-times"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-03", question: "Can I return an item after 30 days?",
    expectedArticles: ["kb-return-window"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-04", question: "Is LM-1042 eligible for a refund?",
    expectedArticles: ["kb-refund-eligibility"], expectedTool: "refund_eligibility", expectedEscalate: false,
  },
  {
    id: "q-05", question: "Why was my card declined?",
    expectedArticles: ["kb-payment-failed"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-06", question: "Do you ship to Bhutan?",
    expectedArticles: ["kb-international-shipping"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-07", question: "My promo code is not working at checkout.",
    expectedArticles: ["kb-promo-codes"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-08", question: "Can I cancel LM-1051?",
    expectedArticles: ["kb-cancel-order"], expectedTool: "lookup_order", expectedEscalate: false,
  },
  {
    id: "q-09", question: "How do I reset my password?",
    expectedArticles: ["kb-account-password"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-10", question: "My parcel says delivered but it is missing.",
    expectedArticles: ["kb-missing-package"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-11", question: "What payment methods do you accept?",
    expectedArticles: ["kb-payment-methods"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-12", question: "Tell me about gift cards and store credit.",
    expectedArticles: ["kb-gift-cards"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-13", question: "Can I exchange an item for a different size?",
    expectedArticles: ["kb-exchanges"], expectedTool: null, expectedEscalate: false,
  },
  {
    id: "q-14", question: "Can you gift-wrap my order in recycled paper and add a handwritten note?",
    expectedArticles: [], expectedTool: null, expectedEscalate: true,
  },
  {
    id: "q-15", question: "I need a VAT invoice for my company's tax filing.",
    expectedArticles: [], expectedTool: null, expectedEscalate: true,
  },
];

export function runEvaluation(agent = createAgent(), questions = LABELLED_QUESTIONS) {
  const rows = questions.map((label) => {
    const answer = answerQuestion(agent, label.question);
    const articleIds = answer.retrieval.map((result) => result.articleId);
    const hasRetrievalLabel = label.expectedArticles.length > 0;
    const hit1 = hasRetrievalLabel ? label.expectedArticles.includes(articleIds[0]) : null;
    const hit3 = hasRetrievalLabel
      ? label.expectedArticles.some((id) => articleIds.slice(0, 3).includes(id))
      : null;
    const rank = label.expectedArticles
      .map((id) => articleIds.indexOf(id))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    const reciprocalRank = !hasRetrievalLabel ? null : rank === undefined ? 0 : 1 / (rank + 1);
    const toolNames = answer.toolCalls.map((call) => call.name);
    const toolCorrect = label.expectedTool
      ? toolNames.includes(label.expectedTool)
      : toolNames.length === 0;
    const escalated = answer.decision === "escalate";
    const escalationCorrect = escalated === Boolean(label.expectedEscalate);
    const cited = answer.citations.some((citation) => label.expectedArticles.includes(citation.articleId));
    const grounded = hasRetrievalLabel ? cited && /\[\d\]/.test(answer.text) : null;
    const passed = (hasRetrievalLabel ? hit3 : true)
      && escalationCorrect
      && toolCorrect
      && (escalated || !hasRetrievalLabel || grounded);

    return {
      ...label,
      topArticleId: articleIds[0] || null,
      articleIds,
      hit1,
      hit3,
      reciprocalRank,
      toolCalls: toolNames,
      toolCorrect,
      confidence: answer.confidence.score,
      decision: answer.decision,
      escalated,
      escalationCorrect,
      grounded,
      passed,
      answer,
    };
  });

  const total = rows.length || 1;
  const retrievalRows = rows.filter((row) => row.hit1 !== null);
  const toolCases = rows.filter((row) => row.expectedTool || row.toolCalls.length > 0);
  const answered = rows.filter((row) => !row.escalated && row.grounded !== null);

  return {
    rows,
    total: rows.length,
    retrievalCases: retrievalRows.length,
    hitAt1: retrievalRows.length
      ? retrievalRows.filter((row) => row.hit1).length / retrievalRows.length
      : 0,
    hitAt3: retrievalRows.length
      ? retrievalRows.filter((row) => row.hit3).length / retrievalRows.length
      : 0,
    mrr: retrievalRows.length
      ? retrievalRows.reduce((sum, row) => sum + row.reciprocalRank, 0) / retrievalRows.length
      : 0,
    toolAccuracy: toolCases.length
      ? toolCases.filter((row) => row.toolCorrect).length / toolCases.length
      : 1,
    escalationAccuracy: rows.filter((row) => row.escalationCorrect).length / total,
    groundingRate: answered.length
      ? answered.filter((row) => row.grounded).length / answered.length
      : 0,
    answerRate: (rows.length - rows.filter((row) => row.escalated).length) / total,
    passedRate: rows.filter((row) => row.passed).length / total,
    avgConfidence: rows.reduce((sum, row) => sum + row.confidence, 0) / total,
    toolCases: toolCases.length,
    escalated: rows.filter((row) => row.escalated).length,
  };
}
