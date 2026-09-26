// Answer composition.
//
// Nothing here pretends to generate language: it ranks sentences from the
// retrieved articles by query-term overlap, quotes the best one or two, and
// attaches numbered citations. Tool results are written first because a concrete
// order fact is more useful than a policy sentence.

import { tokenize } from "./tokenize.js";
import { coverageOf } from "./retrieval.js";
import { describeToolResult } from "./tools.js";

export function splitSentences(text) {
  return String(text || "")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
}

export function sentenceScore(sentence, terms) {
  if (!terms.length) return 0;
  const tokens = new Set(tokenize(sentence));
  let hits = 0;
  for (const term of terms) if (tokens.has(term)) hits += 1;
  return hits / terms.length;
}

/** Best one or two sentences from an article for the query, in document order. */
export function bestSentences(article, terms, max = 2) {
  const sentences = splitSentences(article.body);
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index);
  return ranked.map((entry) => entry.sentence);
}

export function excerpt(article, terms, maxLength = 260) {
  const text = bestSentences(article, terms, 2).join(" ");
  const value = text || article.body;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

/**
 * Compose a reply from retrieval results and tool calls.
 *
 * Returns structured citations so the UI can render chips that expand the quoted
 * passage; the text itself carries `[n]` markers that point at those entries.
 */
export function composeAnswer({ queryText, results = [], toolCalls = [], missingOrderId = false }) {
  const terms = [...new Set(tokenize(queryText))];
  const citations = results
    .filter((result) => result.score > 0)
    .slice(0, 3)
    .map((result, index) => ({
      index: index + 1,
      articleId: result.article.id,
      title: result.article.title,
      category: result.article.category,
      score: Number(result.score.toFixed(3)),
      snippet: excerpt(result.article, terms),
    }));

  const parts = [];

  for (const call of toolCalls) {
    if (call.ok) parts.push(describeToolResult(call));
    else parts.push(call.error?.message || "That lookup did not work.");
  }

  if (missingOrderId) {
    parts.push("I can check that. What is the order number? It starts with LM- followed by four digits, for example LM-1042.");
  }

  const quoted = new Set();
  const quotes = [];
  const topScore = citations.length
    ? (results.find((entry) => entry.article.id === citations[0].articleId)?.score || 0)
    : 0;
  for (const citation of citations.slice(0, 2)) {
    const result = results.find((entry) => entry.article.id === citation.articleId);
    if (!result) continue;
    if (citation.index > 1 && result.score < topScore * 0.55) continue;
    const sentence = bestSentences(result.article, terms, 1)[0];
    if (sentence && !quoted.has(sentence)) {
      quoted.add(sentence);
      quotes.push(`“${sentence}” [${citation.index}]`);
    }
  }
  if (quotes.length) parts.push(quotes.join(" "));

  if (!parts.length) {
    parts.push("I could not find a help-centre passage that answers this directly. I can pass this to a human.");
  }

  return {
    text: parts.join("\n\n"),
    citations,
    coverage: coverageOf(queryText, results.slice(0, 2).map((result) => result.article)),
    quoted: [...quoted],
    terms,
  };
}
