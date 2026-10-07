// Mock order API and the tool planner.
//
// The planner is keyword + identifier based on purpose: a deterministic demo cannot
// hide behind a model's intent guess, so the rules are explicit and the tests can
// pin down exactly when a tool is called. The "API" is an in-memory table with a
// fixed clock, so refund-window answers are reproducible.

export const DEMO_NOW = "2026-10-28";

export const SAMPLE_ORDERS = [
  {
    id: "LM-1042", customer: "Maya Sharma", email: "maya@example.com",
    placedAt: "2026-10-16", deliveredAt: "2026-10-20", status: "delivered",
    total: 5340, currency: "NPR", paymentMethod: "Visa ending 4421",
    carrier: "Nepal Post", tracking: "NP884120045",
    items: [{ name: "Kestrel Rain Jacket", size: "M", colour: "Slate", finalSale: false }],
  },
  {
    id: "LM-1048", customer: "Nima Lama", email: "nima@example.com",
    placedAt: "2026-10-24", deliveredAt: null, status: "shipped",
    total: 2890, currency: "NPR", paymentMethod: "eSewa",
    carrier: "Aramex", tracking: "AR771903311", eta: "2026-10-30",
    items: [{ name: "Tarn Trail Shoes", size: "42", colour: "Moss", finalSale: false }],
  },
  {
    id: "LM-1051", customer: "Aayush Khadka", email: "aayush@example.com",
    placedAt: "2026-10-27", deliveredAt: null, status: "processing",
    total: 1890, currency: "NPR", paymentMethod: "Khalti",
    carrier: null, tracking: null, eta: "2026-11-02",
    items: [{ name: "Ridge Merino Socks", size: "L", colour: "Charcoal", finalSale: false }],
  },
  {
    id: "LM-1055", customer: "Bikash Shrestha", email: "bikash@example.com",
    placedAt: "2026-08-29", deliveredAt: "2026-09-02", status: "delivered",
    total: 1720, currency: "NPR", paymentMethod: "Mastercard ending 9080",
    carrier: "Nepal Post", tracking: "NP882004411",
    items: [{ name: "Ridge Merino Socks", size: "M", colour: "Sand", finalSale: false }],
  },
  {
    id: "LM-1060", customer: "Kabita Gurung", email: "kabita@example.com",
    placedAt: "2026-10-21", deliveredAt: "2026-10-25", status: "delivered",
    total: 3990, currency: "NPR", paymentMethod: "Visa ending 1182",
    carrier: "Aramex", tracking: "AR772004118",
    items: [{ name: "Sundown Fleece", size: "S", colour: "Rust", finalSale: true }],
  },
  {
    id: "LM-1063", customer: "Suman Thapa", email: "suman@example.com",
    placedAt: "2026-09-12", deliveredAt: "2026-09-15", status: "returned",
    total: 6210, currency: "NPR", paymentMethod: "Visa ending 7730",
    carrier: "Nepal Post", tracking: "NP883556700", returnedAt: "2026-09-20",
    items: [{ name: "Kestrel Rain Jacket", size: "L", colour: "Black", finalSale: false }],
  },
  {
    id: "LM-1071", customer: "Priya Gurung", email: "priya@example.com",
    placedAt: "2026-10-20", deliveredAt: null, status: "shipped",
    total: 2140, currency: "NPR", paymentMethod: "eSewa",
    carrier: "Nepal Post", tracking: "NP884998120", eta: "2026-10-26",
    items: [{ name: "Alpine Beanie", size: "One size", colour: "Oat", finalSale: false }],
  },
  {
    id: "LM-1078", customer: "Rojina Karki", email: "rojina@example.com",
    placedAt: "2026-10-14", deliveredAt: "2026-10-18", status: "delivered",
    total: 2450, currency: "NPR", paymentMethod: "Gift card",
    carrier: "Aramex", tracking: "AR770118823",
    items: [{ name: "Trail Daypack 18L", size: "One size", colour: "Navy", finalSale: false }],
  },
];

export const ORDER_BY_ID = new Map(SAMPLE_ORDERS.map((order) => [order.id, order]));

const ORDER_ID_PATTERN = /\bLM[-\s]?(\d{3,5})\b/gi;
const REFUND_INTENT = /\b(refund|refunded|return|returned|send\s+(it\s+)?back|money\s+back|reimburse)\b/i;
const STATUS_INTENT = /\b(where|status|track|tracking|arrive[ds]?|delivery|delivered|shipped|shipment|late|eta|parcel)\b/i;
const CANCEL_INTENT = /\b(cancel|cancellation)\b/i;
const ADDRESS_INTENT = /\b(address|postcode|zip|deliver\s+to)\b/i;
const DAMAGE_INTENT = /\b(damaged|broken|defect|torn|ripped)\b/i;
// A generic policy question ("can I return an item after 30 days?") must not be
// treated as a broken tool call. Only possessives and deictic phrases ("my order",
// "the parcel", "where is my ...") need an identifier to look up.
const SPECIFIC_ORDER = /\b(my|this|that|the)\s+(order|parcel|package|delivery|shipment|item|purchase)\b/i;
const TRACK_MY = /\btrack(?:ing)?\s+(my|the)\b/i;
const WHERE_MY = /\bwhere(?:'s| is)\s+(my|the)\b/i;

export function parseDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function formatDate(iso) {
  const time = parseDate(iso);
  if (time === null) return "";
  return new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function daysBetween(fromIso, toIso) {
  const from = parseDate(fromIso);
  const to = parseDate(toIso);
  if (from === null || to === null) return 0;
  return Math.round((to - from) / 86400000);
}

export function extractOrderIds(text) {
  const ids = [];
  for (const match of String(text || "").matchAll(ORDER_ID_PATTERN)) {
    const id = `LM-${match[1]}`;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function detectIntent(text) {
  const value = String(text || "");
  if (REFUND_INTENT.test(value)) return "refund";
  if (CANCEL_INTENT.test(value)) return "cancel";
  if (DAMAGE_INTENT.test(value)) return "damage";
  if (ADDRESS_INTENT.test(value)) return "address";
  if (STATUS_INTENT.test(value)) return "status";
  return "other";
}

/**
 * Decide which tools to call. Missing identifiers are returned separately so the
 * agent can ask a clarifying question instead of inventing an order number.
 */
export function planTools(message, { orders = SAMPLE_ORDERS } = {}) {
  const orderIds = extractOrderIds(message);
  const intent = detectIntent(message);
  const text = String(message || "");
  const specific = SPECIFIC_ORDER.test(text) || TRACK_MY.test(text) || WHERE_MY.test(text);
  const tools = [];
  const missing = [];

  if (intent === "refund") {
    if (orderIds.length) tools.push({ name: "refund_eligibility", args: { orderId: orderIds[0] } });
    else if (specific) missing.push("orderId");
  } else if (orderIds.length) {
    tools.push({ name: "lookup_order", args: { orderId: orderIds[0] } });
  } else if (specific && ["status", "cancel", "address", "damage"].includes(intent)) {
    missing.push("orderId");
  }

  // Never plan a tool for an identifier that is not in the table; letting the
  // tool return not_found is more honest than silently skipping the lookup.
  const knownOrder = orderIds.length ? orders.some((order) => order.id === orderIds[0]) : false;
  return { intent, tools, missing, orderIds, knownOrder };
}

export function lookupOrder(orderId, { orders = SAMPLE_ORDERS } = {}) {
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    return {
      ok: false,
      error: { code: "not_found", message: `No order matches ${orderId}.` },
    };
  }
  return { ok: true, data: order };
}

export function refundEligibility(orderId, { orders = SAMPLE_ORDERS, now = DEMO_NOW } = {}) {
  const found = lookupOrder(orderId, { orders });
  if (!found.ok) return found;
  const order = found.data;

  if (order.status === "returned") {
    return { ok: true, data: { eligible: false, reason: "This order has already been returned." } };
  }
  if (!order.deliveredAt) {
    return {
      ok: true,
      data: {
        eligible: false,
        reason: `The order is still ${order.status}; refunds start after delivery.`,
      },
    };
  }
  if (order.items.some((item) => item.finalSale)) {
    return { ok: true, data: { eligible: false, reason: "The item was marked final sale and cannot be refunded." } };
  }
  const age = daysBetween(order.deliveredAt, now);
  if (age > 30) {
    const windowEnd = new Date(parseDate(order.deliveredAt) + 30 * 86400000).toISOString().slice(0, 10);
    return {
      ok: true,
      data: {
        eligible: false,
        reason: `The 30-day return window closed on ${formatDate(windowEnd)}.`,
      },
    };
  }
  const windowEnd = new Date(parseDate(order.deliveredAt) + 30 * 86400000).toISOString().slice(0, 10);
  return {
    ok: true,
    data: {
      eligible: true,
      reason: "Inside the 30-day return window and not a final-sale item.",
      amount: order.total,
      currency: order.currency,
      refundMethod: order.paymentMethod === "Gift card" ? "store credit" : "the original payment method",
      windowEndsOn: windowEnd,
    },
  };
}

export function orderSummary(order) {
  if (!order) return "";
  const item = order.items.map((entry) => `${entry.name} (${entry.size})`).join(", ");
  return `${order.id} · ${item} · ${order.currency} ${order.total.toLocaleString("en-US")}`;
}

const TOOL_LATENCY = { lookup_order: 140, refund_eligibility: 220 };

export function executeTool(name, args, { orders = SAMPLE_ORDERS, now = DEMO_NOW } = {}) {
  const started = TOOL_LATENCY[name] || 100;
  if (name === "lookup_order") {
    const result = lookupOrder(args.orderId, { orders });
    return {
      name, args, ok: result.ok, result: result.ok ? result.data : null,
      error: result.ok ? null : result.error, latencyMs: result.ok ? started : started + 40,
    };
  }
  if (name === "refund_eligibility") {
    const result = refundEligibility(args.orderId, { orders, now });
    return {
      name, args, ok: result.ok, result: result.ok ? result.data : null,
      error: result.ok ? null : result.error, latencyMs: result.ok ? started : started + 40,
    };
  }
  return {
    name, args, ok: false, result: null,
    error: { code: "unknown_tool", message: `No tool named ${name}.` }, latencyMs: 50,
  };
}

export function executePlan(plan, options = {}) {
  return plan.tools.map((tool) => executeTool(tool.name, tool.args, options));
}

export function toolDisplayName(name) {
  if (name === "lookup_order") return "lookup_order";
  if (name === "refund_eligibility") return "refund_eligibility";
  return name;
}

export function describeToolResult(call) {
  if (!call.ok) return call.error?.message || "Tool call failed.";
  if (call.name === "lookup_order") {
    const order = call.result;
    if (order.status === "delivered") {
      return `Delivered on ${formatDate(order.deliveredAt)} by ${order.carrier}. Tracking ${order.tracking}.`;
    }
    if (order.status === "shipped") {
      return `Shipped by ${order.carrier}. Tracking ${order.tracking}, estimated ${formatDate(order.eta)}.`;
    }
    return `Currently ${order.status}, estimated ${order.eta ? formatDate(order.eta) : "after packing"}.`;
  }
  if (call.name === "refund_eligibility") {
    const data = call.result;
    if (!data.eligible) return data.reason;
    return `Eligible for ${data.currency} ${data.amount.toLocaleString("en-US")} to ${data.refundMethod}; window closes ${formatDate(data.windowEndsOn)}.`;
  }
  return "Tool completed.";
}
