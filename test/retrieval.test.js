import test from "node:test";
import assert from "node:assert/strict";
import { stem, tokenize, uniqueTerms, termFrequency } from "../src/tokenize.js";
import {
  buildIndex, coverageOf, hitAtK, normalizeScore, reciprocalRank, search,
} from "../src/retrieval.js";
import { HELP_CENTRE } from "../src/corpus.js";

const index = buildIndex(HELP_CENTRE);
const ids = (results) => results.map((result) => result.article.id);

test("tokenizer lowercases, splits and removes stopwords", () => {
  assert.deepEqual(tokenize("Where are my Refunds?"), ["where", "refund"]);
  assert.deepEqual(tokenize("How do I reset my password?"), ["reset", "password"]);
  assert.deepEqual(tokenize(""), []);
  assert.deepEqual(tokenize("!!!"), []);
});

test("stem folds common plurals without destroying short words", () => {
  assert.equal(stem("orders"), "order");
  assert.equal(stem("policies"), "policy");
  assert.equal(stem("boxes"), "box");
  assert.equal(stem("days"), "day");
  assert.equal(stem("shipping"), "shipping");
  assert.equal(stem("is"), "is");
});

test("termFrequency and uniqueTerms count content tokens", () => {
  const tokens = tokenize("refund refund policy policy order");
  assert.equal(termFrequency(tokens).get("refund"), 2);
  assert.deepEqual(uniqueTerms("refund refund policy"), ["refund", "policy"]);
});

test("the index covers all twenty articles", () => {
  assert.equal(index.n, 20);
  assert.equal(index.docs.size, 20);
  assert.ok(index.idf.get("refund") > 0);
  assert.ok(index.avgLength > 0);
});

test("BM25 ranks the order-status article for a where-is-my-order query", () => {
  const results = search(index, "Where is my order?");
  assert.equal(results[0].article.id, "kb-order-status");
  assert.ok(results[0].score > 0);
  assert.ok(results[0].matchedTerms.includes("order"));
});

test("BM25 ranks refund policy and delivery articles correctly", () => {
  assert.equal(search(index, "Is my order eligible for a refund?")[0].article.id, "kb-refund-eligibility");
  assert.equal(search(index, "How long does standard delivery take?")[0].article.id, "kb-delivery-times");
  assert.equal(search(index, "Do you ship to Bhutan?")[0].article.id, "kb-international-shipping");
  assert.equal(search(index, "reset password")[0].article.id, "kb-account-password");
});

test("search respects the limit and returns no results for a stopword-only query", () => {
  assert.equal(search(index, "order refund return", { limit: 2 }).length, 2);
  assert.deepEqual(search(index, "the and of"), []);
});

test("normalizeScore saturates in the unit interval", () => {
  assert.equal(normalizeScore(0), 0);
  assert.ok(normalizeScore(2) > 0 && normalizeScore(2) < 0.5);
  assert.ok(normalizeScore(20) > 0.9);
  assert.ok(normalizeScore(200) <= 1);
});

test("coverageOf measures how many query terms the passages contain", () => {
  const articles = [HELP_CENTRE.find((article) => article.id === "kb-refund-eligibility")];
  assert.ok(coverageOf("refund eligibility", articles) > 0.9);
  assert.ok(coverageOf("bhutan customs", articles) < 0.3);
  assert.equal(coverageOf("", articles), 0);
});

test("hitAtK and reciprocalRank report where the labelled article landed", () => {
  const results = search(index, "where is my order");
  assert.equal(hitAtK(results, ["kb-order-status"], 1), true);
  assert.equal(hitAtK(results, ["kb-order-status"], 3), true);
  assert.equal(hitAtK(results, ["kb-unknown"], 3), false);
  assert.equal(reciprocalRank(results, ["kb-order-status"]), 1);
  const lower = search(index, "refund");
  assert.ok(reciprocalRank(lower, ["kb-refund-timing"]) > 0);
});
