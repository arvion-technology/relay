import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_NOW, SAMPLE_ORDERS, daysBetween, describeToolResult, detectIntent,
  executePlan, executeTool, extractOrderIds, formatDate, lookupOrder, orderSummary,
  planTools, refundEligibility,
} from "../src/tools.js";

test("order ids are normalised from common formats", () => {
  assert.deepEqual(extractOrderIds("where is lm 1042?"), ["LM-1042"]);
  assert.deepEqual(extractOrderIds("LM-1048 and LM-1051"), ["LM-1048", "LM-1051"]);
  assert.deepEqual(extractOrderIds("LM-1048 and LM-1048"), ["LM-1048"]);
  assert.deepEqual(extractOrderIds("no order here"), []);
});

test("intent detection separates refunds, status, cancellation and damage", () => {
  assert.equal(detectIntent("I want a refund for LM-1055"), "refund");
  assert.equal(detectIntent("Where is my order?"), "status");
  assert.equal(detectIntent("Can I cancel LM-1051?"), "cancel");
  assert.equal(detectIntent("The jacket arrived damaged"), "damage");
  assert.equal(detectIntent("Do you ship to Bhutan?"), "other");
});

test("planner calls the refund tool when an order id and refund intent are present", () => {
  const plan = planTools("Is LM-1042 eligible for a refund?");
  assert.equal(plan.intent, "refund");
  assert.deepEqual(plan.tools, [{ name: "refund_eligibility", args: { orderId: "LM-1042" } }]);
  assert.deepEqual(plan.missing, []);
});

test("planner calls the lookup tool for order status questions", () => {
  assert.deepEqual(planTools("Where is LM-1048?").tools, [{ name: "lookup_order", args: { orderId: "LM-1048" } }]);
  assert.deepEqual(planTools("Can I cancel LM-1051?").tools[0].name, "lookup_order");
});

test("generic policy questions do not request an order id", () => {
  const returns = planTools("Can I return an item after 30 days?");
  assert.deepEqual(returns.tools, []);
  assert.deepEqual(returns.missing, []);
  const delivery = planTools("How long does standard delivery take?");
  assert.deepEqual(delivery.tools, []);
  assert.deepEqual(delivery.missing, []);
});

test("specific questions without an id ask for one instead of guessing", () => {
  const where = planTools("Where is my order?");
  assert.equal(where.missing.includes("orderId"), true);
  assert.deepEqual(where.tools, []);
  const refund = planTools("I want a refund for my order");
  assert.equal(refund.missing.includes("orderId"), true);
});

test("lookup and refund eligibility return concrete order data", () => {
  const lookup = lookupOrder("LM-1042");
  assert.equal(lookup.ok, true);
  assert.equal(lookup.data.status, "delivered");
  assert.equal(lookup.data.items[0].name, "Kestrel Rain Jacket");

  const eligible = refundEligibility("LM-1042", { now: DEMO_NOW });
  assert.equal(eligible.ok, true);
  assert.equal(eligible.data.eligible, true);
  assert.equal(eligible.data.amount, 5340);
  assert.equal(eligible.data.refundMethod, "the original payment method");
});

test("refund eligibility applies the window, final-sale and status rules", () => {
  assert.equal(refundEligibility("LM-1055", { now: DEMO_NOW }).data.eligible, false); // 30-day window
  assert.match(refundEligibility("LM-1055", { now: DEMO_NOW }).data.reason, /window closed/);
  assert.equal(refundEligibility("LM-1060", { now: DEMO_NOW }).data.eligible, false); // final sale
  assert.match(refundEligibility("LM-1060", { now: DEMO_NOW }).data.reason, /final sale/);
  assert.equal(refundEligibility("LM-1063", { now: DEMO_NOW }).data.eligible, false); // returned
  assert.equal(refundEligibility("LM-1048", { now: DEMO_NOW }).data.eligible, false); // not delivered
  assert.equal(refundEligibility("LM-1078", { now: DEMO_NOW }).data.refundMethod, "store credit");
});

test("unknown orders return a typed not_found error", () => {
  const lookup = lookupOrder("LM-9999");
  assert.equal(lookup.ok, false);
  assert.equal(lookup.error.code, "not_found");
  assert.match(lookup.error.message, /LM-9999/);
  assert.equal(refundEligibility("LM-9999").ok, false);
});

test("executePlan runs each planned tool with a deterministic latency", () => {
  const calls = executePlan(planTools("I want a refund for LM-1055"), { now: DEMO_NOW });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "refund_eligibility");
  assert.equal(calls[0].ok, true);
  assert.ok(calls[0].latencyMs >= 50);
  assert.match(describeToolResult(calls[0]), /window closed/);
  const unknown = executeTool("quote_shipping", {}, {});
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, "unknown_tool");
});

test("date and summary helpers use the fixed demo clock", () => {
  assert.equal(formatDate("2026-10-20"), "20 Oct 2026");
  assert.equal(daysBetween("2026-10-20", DEMO_NOW), 8);
  assert.match(orderSummary(SAMPLE_ORDERS[0]), /LM-1042/);
  assert.match(orderSummary(SAMPLE_ORDERS[0]), /Kestrel Rain Jacket/);
});
