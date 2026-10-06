// BM25 retrieval over the help centre.
//
// Twenty articles is far below the point where a vector database earns its keep.
// BM25 gives explainable, deterministic scores from an inverted term index, which
// matters here because the demo shows the score breakdown to the operator.

import { tokenize, termFrequency } from "./tokenize.js";

export const BM25_K1 = 1.4;
export const BM25_B = 0.75;

export function buildIndex(articles) {
  const docs = new Map();
  let totalLength = 0;
  for (const article of articles) {
    // The title appears twice on purpose: it is the strongest signal of what the
    // article answers, and duplicating it is a cheap field boost without adding
    // a second scoring path.
    const indexedText = `${article.title} ${article.title} ${article.body} ${(article.tags || []).join(" ")}`;
    const tokens = tokenize(indexedText);
    const tf = termFrequency(tokens);
    docs.set(article.id, { article, tf, length: tokens.length });
    totalLength += tokens.length;
  }

  const df = new Map();
  for (const doc of docs.values()) {
    for (const term of doc.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  const n = docs.size || 1;
  const avgLength = totalLength / n || 1;

  const idf = new Map();
  for (const [term, frequency] of df) {
    idf.set(term, Math.log(1 + (n - frequency + 0.5) / (frequency + 0.5)));
  }

  return { articles, docs, df, idf, n, avgLength };
}

function bm25TermScore(index, doc, term) {
  const tf = doc.tf.get(term);
  if (!tf) return 0;
  const idf = index.idf.get(term) || 0;
  const lengthNorm = 1 - BM25_B + BM25_B * (doc.length / index.avgLength);
  return idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * lengthNorm));
}

export function search(index, query, { limit = 5 } = {}) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const unique = [...new Set(terms)];
  const scored = [];
  for (const doc of index.docs.values()) {
    let score = 0;
    const matched = [];
    for (const term of unique) {
      const contribution = bm25TermScore(index, doc, term);
      if (contribution > 0) matched.push(term);
      score += contribution;
    }
    if (score > 0) scored.push({ article: doc.article, score, matchedTerms: matched });
  }
  scored.sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id));
  return scored.slice(0, Math.max(0, limit)).map((row, rank) => ({ ...row, rank: rank + 1 }));
}

/** Saturating score in 0..1 so the confidence model does not depend on corpus size. */
export function normalizeScore(score) {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return 1 - Math.exp(-score / 6);
}

/** Fraction of unique query terms that appear in a list of articles. */
export function coverageOf(query, articles) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !articles.length) return 0;
  const corpus = tokenize(articles.map((article) => `${article.title} ${article.body} ${(article.tags || []).join(" ")}`).join(" "));
  const available = new Set(corpus);
  const matched = terms.filter((term) => available.has(term)).length;
  return matched / terms.length;
}

export function hitAtK(results, expectedIds, k = 3) {
  const top = results.slice(0, k).map((result) => result.article.id);
  return expectedIds.some((id) => top.includes(id));
}

export function reciprocalRank(results, expectedIds) {
  for (let i = 0; i < results.length; i++) {
    if (expectedIds.includes(results[i].article.id)) return 1 / (i + 1);
  }
  return 0;
}
