// Tokenizer for the help-centre index.
//
// The corpus is small and English, so a compact normaliser is enough: lowercase,
// split on non-alphanumerics, drop stopwords, then a light plural stem. Keeping
// this separate from BM25 makes the stemming rules testable on their own.

export const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "could",
  "did", "do", "does", "for", "from", "had", "has", "have", "how", "i", "if", "in",
  "into", "is", "it", "its", "me", "my", "of", "on", "or", "our", "please", "so",
  "that", "the", "their", "them", "then", "there", "these", "they", "this", "to",
  "was", "we", "were", "what", "when", "which", "who", "will", "with",
  "would", "you", "your", "am", "im", "ive", "dont", "cant", "isnt", "not",
  "still", "just", "also", "really", "very", "again", "currently", "get", "got",
]);

/** Plural folding only. A full Porter stemmer would obscure the help-centre terms. */
export function stem(token) {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("ses") || token.endsWith("xes") || token.endsWith("ches") || token.endsWith("shes")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us")) return token.slice(0, -1);
  return token;
}

export function tokenize(text) {
  if (!text) return [];
  const raw = String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .split(/\s+/);
  const tokens = [];
  for (const part of raw) {
    const token = part.replace(/^'+|'+$/g, "").replace(/'/g, "");
    if (!token) continue;
    if (STOPWORDS.has(token)) continue;
    if (token.length < 2 && !/^\d+$/.test(token)) continue;
    tokens.push(stem(token));
  }
  return tokens;
}

/** Unique content terms in first-seen order; used for coverage scoring. */
export function uniqueTerms(text) {
  return [...new Set(tokenize(text))];
}

export function termFrequency(tokens) {
  const tf = new Map();
  for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
  return tf;
}

export function detokenize(tokens) {
  return tokens.join(" ");
}
