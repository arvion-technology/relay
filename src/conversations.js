// Seeded conversation log for the admin views. Each conversation is produced by
// running the actual agent, so the log, metrics and eval tab are consistent with
// the code rather than being painted numbers.

import { answerQuestion, createAgent } from "./agent.js";
import { escalateConversation } from "./escalation.js";
import { DEMO_NOW } from "./tools.js";

const SEEDS = [
  {
    id: "conv-4112", at: "2026-10-28T09:12:00", queue: "Tier 1 · General",
    customer: { name: "Maya Sharma", email: "maya@example.com", initials: "MS", plan: "Returns and exchanges" },
    question: "Where is my order LM-1042?",
    followUp: "Can I return the jacket from LM-1042?",
    followUpAt: "2026-10-28T09:16:00",
    tag: "Order status",
  },
  {
    id: "conv-4109", at: "2026-10-28T09:03:00", queue: "Tier 1 · General",
    customer: { name: "Nima Lama", email: "nima@example.com", initials: "NL", plan: "Shipping" },
    question: "Where is LM-1048?",
    tag: "Order status",
  },
  {
    id: "conv-4104", at: "2026-10-28T08:48:00", queue: "Tier 1 · General",
    customer: { name: "Anika Rai", email: "anika@example.com", initials: "AR", plan: "Shipping" },
    question: "Do you ship to Bhutan and how long does it take?",
    tag: "International",
  },
  {
    id: "conv-4098", at: "2026-10-28T08:31:00", queue: "Tier 1 · Returns",
    customer: { name: "Bikash Shrestha", email: "bikash@example.com", initials: "BS", plan: "Returns and exchanges" },
    question: "I want a refund for LM-1055.",
    tag: "Refund policy",
  },
  {
    id: "conv-4091", at: "2026-10-28T08:12:00", queue: "Tier 2 · Products",
    customer: { name: "Priya Gurung", email: "priya@example.com", initials: "PG", plan: "Order changes" },
    question: "Can you gift-wrap my order in recycled paper and add a handwritten note?",
    tag: "Out of scope",
  },
  {
    id: "conv-4087", at: "2026-10-28T07:55:00", queue: "Tier 2 · Billing",
    customer: { name: "Suman Thapa", email: "suman@example.com", initials: "ST", plan: "Billing" },
    question: "I need a VAT invoice for my company's tax filing.",
    tag: "Billing",
  },
  {
    id: "conv-4082", at: "2026-10-27T18:20:00", queue: "Tier 1 · General",
    customer: { name: "Rojina Karki", email: "rojina@example.com", initials: "RK", plan: "Account" },
    question: "How do I reset my password?",
    tag: "Account",
  },
  {
    id: "conv-4076", at: "2026-10-27T17:44:00", queue: "Tier 1 · General",
    customer: { name: "Aayush Khadka", email: "aayush@example.com", initials: "AK", plan: "Order changes" },
    question: "Can I cancel LM-1051?",
    tag: "Cancellation",
  },
  {
    id: "conv-4070", at: "2026-10-27T16:58:00", queue: "Tier 2 · Products",
    customer: { name: "Kabita Gurung", email: "kabita@example.com", initials: "KG", plan: "Returns and exchanges" },
    question: "The Sundown Fleece from LM-1060 arrived damaged.",
    tag: "Damage",
  },
  {
    id: "conv-4064", at: "2026-10-27T16:21:00", queue: "Tier 1 · General",
    customer: { name: "Dorje Wang", email: "dorje@example.com", initials: "DW", plan: "Payments" },
    question: "What payment methods do you accept?",
    tag: "Payments",
  },
];

function addMinutes(iso, minutes) {
  const time = Date.parse(`${iso}Z`);
  return new Date(time + minutes * 60000).toISOString().slice(0, 19);
}

function buildConversation(seed, agent, index) {
  const messages = [];
  const first = answerQuestion(agent, seed.question);
  messages.push({
    id: `${seed.id}-m1`, role: "customer", at: seed.at, text: seed.question,
  });
  messages.push({
    id: `${seed.id}-m2`, role: "agent", at: addMinutes(seed.at, 1), ...first,
  });

  if (seed.followUp) {
    const followUp = answerQuestion(agent, seed.followUp);
    messages.push({
      id: `${seed.id}-m3`, role: "customer", at: seed.followUpAt || addMinutes(seed.at, 4), text: seed.followUp,
    });
    messages.push({
      id: `${seed.id}-m4`, role: "agent", at: addMinutes(seed.followUpAt || addMinutes(seed.at, 4), 1), ...followUp,
    });
  }

  const conversation = {
    id: seed.id,
    customer: seed.customer,
    channel: "Web chat",
    startedAt: seed.at,
    index,
    tag: seed.tag,
    queue: seed.queue,
    firstResponseMs: first.latencyMs,
    status: "resolved",
    ticket: null,
    messages,
  };
  return conversation;
}

export function seedConversations(agent = createAgent()) {
  let ticketSequence = 0;
  return SEEDS.map((seed) => {
    let conversation = buildConversation(seed, agent, SEEDS.indexOf(seed));
    const last = [...conversation.messages].reverse().find((message) => message.role === "agent");
    if (last?.decision === "escalate") {
      ticketSequence += 1;
      conversation = escalateConversation(conversation, {
        reason: { text: `Agent confidence ${Math.round(last.confidence.score * 100)}%`, priority: "normal" },
        sequence: ticketSequence,
        now: DEMO_NOW,
        queue: seed.queue,
      });
    }
    return conversation;
  });
}

export const SEED_COUNT = SEEDS.length;
