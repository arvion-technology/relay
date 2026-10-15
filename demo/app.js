// Relay demo — support console UI.
//
// All reasoning lives in ../src (retrieval, composer, tools, confidence,
// escalation, evaluation). This file renders the transcript and the operator
// views and keeps the current chat state; there is no network call anywhere.

import { createAgent, answerQuestion } from "../src/agent.js";
import { ARTICLE_BY_ID } from "../src/corpus.js";
import { runEvaluation } from "../src/evaluation.js";
import { seedConversations } from "../src/conversations.js";
import { confidenceBuckets, lastAgentMessage, summariseConversations } from "../src/metrics.js";
import { escalateConversation } from "../src/escalation.js";
import { DEMO_NOW, describeToolResult } from "../src/tools.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const ICONS = {
  tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.5 2.5-2.8-2.8z"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4z"/><path d="M12 7v10" stroke-dasharray="2 3"/></svg>',
};

const agent = createAgent();
const VIEW_TITLES = { chat: "Live chat", conversations: "Conversations", evaluation: "Evaluation" };

const state = {
  view: "chat",
  conversations: seedConversations(agent),
  chat: null,
  typing: false,
  lastAgent: null,
  messageSeq: 0,
  evaluation: null,
};

const dom = {
  crumb: $("#view-crumb"),
  transcript: $("#transcript"),
  trace: $("#trace"),
  chatInput: $("#chat-input"),
  sendButton: $("#send-message"),
  composer: $("#composer"),
  chatAvatar: $("#chat-avatar"),
  chatName: $("#chat-customer-name"),
  chatMeta: $("#chat-customer-meta"),
  chatStatus: $("#chat-status"),
  suggestions: $("#suggestions"),
  convStats: $("#conv-stats"),
  convTable: $("#conv-table"),
  convCount: $("#conv-count"),
  ticketsList: $("#tickets-list"),
  ticketCount: $("#ticket-count"),
  confMix: $("#conf-mix"),
  evalStats: $("#eval-stats"),
  evalTable: $("#eval-table"),
  evalPassRate: $("#eval-pass-rate"),
  evalSubtitle: $("#eval-subtitle"),
  navConvCount: $("#nav-conversations-count"),
  navEvalCount: $("#nav-evaluation-count"),
};

/* ------------------------------------------------------------------ helpers */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function percent(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function confidenceBand(score) {
  if (score >= 0.8) return "high";
  if (score >= 0.62) return "medium";
  return "low";
}

function confidencePill(score) {
  if (!Number.isFinite(score)) return '<span class="badge">n/a</span>';
  const band = confidenceBand(score);
  const tone = band === "high" ? "green" : band === "medium" ? "gold" : "red";
  return `<span class="badge ${tone}">${percent(score)}</span>`;
}

function decisionLabel(decision) {
  if (decision === "answer") return "Answered";
  if (decision === "clarify") return "Needs order number";
  return "Escalated";
}

function decisionTone(decision) {
  if (decision === "answer") return "green";
  if (decision === "clarify") return "gold";
  return "red";
}

function confidenceBar(score) {
  const band = confidenceBand(score);
  return `<span class="conf-bar ${band}"><i style="width:${Math.round(score * 100)}%"></i></span>`;
}

function formatAt(at) {
  if (!at) return "";
  const text = String(at);
  return text.includes("T") ? text.slice(11, 16) : text;
}

function ticketSequence() {
  const numbers = state.conversations
    .map((conversation) => conversation.ticket?.id)
    .filter(Boolean)
    .map((id) => Number(id.split("-")[1]) - 1000)
    .filter((value) => Number.isFinite(value));
  return Math.max(0, ...numbers) + 1;
}

function nextMessageId() {
  state.messageSeq += 1;
  return `live-m${state.messageSeq}`;
}

function escapeWithCitations(text) {
  return escapeHtml(text).replace(/\[(\d)\]/g, '<span class="cite">[$1]</span>');
}

/* -------------------------------------------------------------------- chat */

function newChat() {
  const question = "Where is my order LM-1042?";
  const answer = answerQuestion(agent, question);
  state.messageSeq = 0;
  state.chat = {
    id: "conv-live",
    customer: {
      name: "Maya Sharma",
      email: "maya@example.com",
      initials: "MS",
      plan: "Returns and exchanges",
    },
    channel: "Web chat",
    startedAt: "2026-10-28T09:12:00",
    firstResponseMs: answer.latencyMs,
    status: "open",
    ticket: null,
    messages: [
      { id: nextMessageId(), role: "customer", text: question, at: "09:12" },
      { id: nextMessageId(), role: "agent", at: "09:13", ...answer },
    ],
  };
  state.lastAgent = state.chat.messages[1];
  state.typing = false;
}

function toolCallHTML(call) {
  const args = Object.entries(call.args || {})
    .map(([key, value]) => `${key}: "${value}"`)
    .join(", ");
  const result = call.ok ? describeToolResult(call) : (call.error?.message || "Tool failed.");
  return `
    <div class="tool-call">
      <div class="tool-head">
        ${ICONS.tool}
        <span class="mono">${escapeHtml(call.name)}</span>
        <span class="badge ${call.ok ? "green" : "red"}">${call.ok ? "ok" : "error"}</span>
        <span class="args">{ ${escapeHtml(args)} }</span>
      </div>
      <div class="tool-result ${call.ok ? "" : "err"}">${escapeHtml(result)}</div>
    </div>`;
}

function ticketHTML(ticket) {
  return `
    <div class="ticket-event">
      <span class="ticket-icon">${ICONS.ticket}</span>
      <div style="min-width:0">
        <b>Handed off to a human · ${escapeHtml(ticket.id)}</b>
        <p>${escapeHtml(ticket.reason)} · queued to ${escapeHtml(ticket.queue)} · first response within ${ticket.slaMinutes} min</p>
        <div class="ticket-meta">
          <span class="badge red">${escapeHtml(ticket.status)}</span>
          <span class="badge">${ticket.messageCount} transcript entries</span>
          <span class="badge">${escapeHtml(ticket.customer.name)}</span>
        </div>
      </div>
    </div>`;
}

function citationsHTML(message) {
  if (!message.citations?.length) return "";
  const chips = message.citations.map((citation) => `
    <button class="citation-chip" data-cite="${citation.index}" type="button" title="Show the quoted passage">
      <span class="idx">${citation.index}</span>
      <span class="title">${escapeHtml(citation.title)}</span>
    </button>`).join("");
  const details = message.citations.map((citation) => `
    <div class="citation-detail" data-detail="${citation.index}" hidden>
      “${escapeHtml(citation.snippet)}”
      <span class="src">${escapeHtml(citation.title)} · ${escapeHtml(citation.category)}</span>
    </div>`).join("");
  return `<div class="citation-chips">${chips}</div>${details}`;
}

function messageHTML(message) {
  if (message.role === "ticket") return ticketHTML(message.ticket);
  if (message.role === "customer") {
    return `
      <div class="msg customer">
        <span class="avatar blue">${escapeHtml(state.chat.customer.initials)}</span>
        <div class="msg-body">
          <div class="msg-meta"><b>${escapeHtml(state.chat.customer.name)}</b><span>${escapeHtml(formatAt(message.at))}</span></div>
          <div class="bubble">${escapeHtml(message.text)}</div>
        </div>
      </div>`;
  }
  const tools = (message.toolCalls || []).map(toolCallHTML).join("");
  return `
    <div class="msg agent">
      <span class="avatar relay-avatar">R</span>
      <div class="msg-body">
        <div class="msg-meta"><b>Relay</b><span>${escapeHtml(formatAt(message.at))}</span></div>
        <div class="bubble">${escapeWithCitations(message.text)}</div>
        <div class="evidence">
          ${tools}
          ${citationsHTML(message)}
          <div class="confidence-line">
            ${confidenceBar(message.confidence.score)}
            ${percent(message.confidence.score)} confidence
            <span class="badge ${decisionTone(message.decision)} decision-badge">${decisionLabel(message.decision)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function renderChat() {
  const chat = state.chat;
  if (!chat) return;
  dom.chatAvatar.textContent = chat.customer.initials || "MS";
  dom.chatName.textContent = chat.customer.name;
  dom.chatMeta.textContent = `${chat.customer.email} · ${chat.channel}`;
  if (chat.ticket) {
    dom.chatStatus.className = "badge red";
    dom.chatStatus.innerHTML = `<span class="dot"></span>Ticket ${escapeHtml(chat.ticket.id)}`;
  } else {
    dom.chatStatus.className = "badge green";
    dom.chatStatus.innerHTML = '<span class="dot pulse"></span>AI agent';
  }

  const parts = [
    '<div class="day-chip">Today · demo workspace</div>',
    '<div class="system-note">Relay answers from the help centre and the order API. Every citation below links to the article it quotes.</div>',
  ];
  for (const message of chat.messages) parts.push(messageHTML(message));
  if (state.typing) {
    parts.push(`
      <div class="msg agent">
        <span class="avatar relay-avatar">R</span>
        <div class="msg-body">
          <div class="msg-meta"><b>Relay</b><span>typing</span></div>
          <div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>
        </div>
      </div>`);
  }
  dom.transcript.innerHTML = parts.join("");
  dom.transcript.scrollTop = dom.transcript.scrollHeight;

  const disabled = Boolean(chat.ticket) || state.typing;
  dom.chatInput.disabled = disabled;
  dom.sendButton.disabled = disabled;
  dom.chatInput.placeholder = chat.ticket
    ? `A human has this conversation (${chat.ticket.id}). Reset chat to start again.`
    : "Ask Relay about an order, returns, shipping…";
  for (const button of $$("#suggestions .suggest")) button.disabled = disabled;
  dom.suggestions.style.opacity = disabled ? "0.55" : "";
}

/* ------------------------------------------------------------------- trace */

function renderTrace() {
  const message = lastAgentMessage(state.chat) || state.lastAgent;
  if (!message) { dom.trace.innerHTML = '<p class="muted small">No run yet.</p>'; return; }
  const score = message.confidence.score;
  const band = confidenceBand(score);
  const citationCount = message.citations?.length || 0;
  const quotedCount = new Set((message.text.match(/\[(\d)\]/g) || [])).size;

  const retrieval = (message.retrieval || []).slice(0, 3).map((result) => `
    <div class="retrieval-row">
      <div>
        <span class="title">${escapeHtml(result.title)}</span>
        <span class="cat">${escapeHtml(result.category)}</span>
        <span class="bar"><i style="width:${Math.round(result.normalized * 100)}%"></i></span>
      </div>
      <span class="score">${result.score.toFixed(2)}</span>
    </div>`).join("") || '<p class="small muted" style="margin:0">No passage cleared the score floor.</p>';

  const tools = message.toolCalls?.length
    ? message.toolCalls.map((call) => `
      <div class="trace-tool">
        <div class="row">${ICONS.tool}<span class="mono">${escapeHtml(call.name)}</span><span class="badge ${call.ok ? "green" : "red"}">${call.ok ? "ok" : "error"}</span></div>
        <p>${escapeHtml(call.ok ? describeToolResult(call) : call.error?.message || "Tool failed")}</p>
      </div>`).join("")
    : '<p class="small muted" style="margin:0">No tool call. This question is answerable from the help centre.</p>';

  const handoff = state.chat?.ticket
    ? `<div class="ticket-mini">
         <div class="row">${ICONS.ticket}<b>${escapeHtml(state.chat.ticket.id)}</b><span class="badge red" style="margin-left:auto">open</span></div>
         <p>Transcript of ${state.chat.ticket.messageCount} messages attached. Queued to ${escapeHtml(state.chat.ticket.queue)}.</p>
       </div>`
    : `<button class="btn handoff-btn" id="handoff-btn" type="button">Hand off to a human</button>
       <p class="small muted" style="margin:0;font-size:9.5px">Creates a ticket with the full transcript and the confidence score.</p>`;

  dom.trace.innerHTML = `
    <div class="trace-head">
      <div class="card-title">Run trace</div>
      <span class="badge purple">deterministic</span>
    </div>
    <p class="trace-sub">Last turn · ${escapeHtml(formatAt(message.at))} · intent “${escapeHtml(message.intent || "other")}”</p>

    <div class="confidence-block">
      <div class="conf-top">
        <div class="conf-score">${Math.round(score * 100)}<small>%</small></div>
        <div>
          <div class="conf-note">Confidence · ${band}</div>
          <div class="small muted">threshold ${Math.round(message.confidence.threshold * 100)}%</div>
        </div>
        <span class="badge ${decisionTone(message.decision)} conf-label">${decisionLabel(message.decision)}</span>
      </div>
      <div class="conf-meter ${band}"><i style="width:${Math.round(score * 100)}%"></i></div>
      <div class="components">
        <div class="component"><span>Retrieval</span><b>${message.confidence.components.retrieval.toFixed(2)}</b></div>
        <div class="component"><span>Coverage</span><b>${message.confidence.components.coverage.toFixed(2)}</b></div>
        <div class="component"><span>Tools</span><b>${message.confidence.components.tools >= 0 ? "+" : ""}${message.confidence.components.tools.toFixed(2)}</b></div>
      </div>
    </div>

    <div class="trace-section">
      <h4>Retrieved passages</h4>
      <div class="retrieval-list">${retrieval}</div>
    </div>

    <div class="trace-section">
      <h4>Tool calls</h4>
      <div class="trace-tools">${tools}</div>
    </div>

    <div class="trace-section">
      <h4>Citations</h4>
      <p class="small muted" style="margin:0">${citationCount} source${citationCount === 1 ? "" : "s"} retrieved · ${quotedCount} quoted in the reply. Open a chip in the transcript to read the passage.</p>
    </div>

    ${handoff}
    <div class="trace-foot"><span class="dot" style="color:var(--green)"></span>${message.latencyMs} ms simulated latency · no network</div>
  `;
}

/* --------------------------------------------------------------- messaging */

function pushMessage(message) {
  state.chat = { ...state.chat, messages: [...state.chat.messages, message] };
}

function sendMessage(raw) {
  const text = String(raw || "").trim();
  if (!text || state.typing || !state.chat || state.chat.ticket) return;
  dom.chatInput.value = "";
  pushMessage({ id: nextMessageId(), role: "customer", text, at: "09:14" });
  state.typing = true;
  renderChat();

  const answer = answerQuestion(agent, text);
  setTimeout(() => {
    state.typing = false;
    pushMessage({ id: nextMessageId(), role: "agent", at: "09:15", ...answer });
    state.lastAgent = lastAgentMessage(state.chat);

    if (answer.decision === "escalate") {
      const escalated = escalateConversation(state.chat, {
        reason: {
          text: `Agent confidence ${percent(answer.confidence.score)} was below the ${percent(answer.confidence.threshold)} threshold`,
          priority: "normal",
        },
        sequence: ticketSequence(),
        now: DEMO_NOW,
        queue: "Tier 1 · General",
      });
      state.chat = escalated;
      state.conversations = [escalated, ...state.conversations.filter((conversation) => conversation.id !== escalated.id)];
      A.toast?.(`Low confidence · handed off as ${escalated.ticket.id}`, "info", 2800);
    }

    if (!state.chat.firstResponseMs) state.chat.firstResponseMs = answer.latencyMs;
    updateCounts();
    renderChat();
    renderTrace();
    renderConversations();
  }, 720);
}

function handOff() {
  if (!state.chat || state.chat.ticket) return;
  const last = lastAgentMessage(state.chat);
  const escalated = escalateConversation(state.chat, {
    reason: {
      text: last
        ? `Operator requested hand-off at ${percent(last.confidence.score)} agent confidence`
        : "Operator requested hand-off",
      priority: "high",
    },
    sequence: ticketSequence(),
    now: DEMO_NOW,
    queue: "Tier 1 · General",
  });
  state.chat = escalated;
  state.conversations = [escalated, ...state.conversations.filter((conversation) => conversation.id !== escalated.id)];
  updateCounts();
  renderChat();
  renderTrace();
  renderConversations();
  A.toast?.(`Ticket ${escalated.ticket.id} created with the transcript`, "success", 2800);
}

/* ------------------------------------------------------------------ views */

function statCard({ label, value, sub, tone = "" }) {
  return `<div class="card"><div class="stat">
    <div class="stat-label">${escapeHtml(label)}</div>
    <div class="stat-value ${tone}">${value}</div>
    <div class="small muted">${escapeHtml(sub)}</div>
  </div></div>`;
}

function renderConversations() {
  const conversations = state.conversations;
  const summary = summariseConversations(conversations);
  const tickets = conversations.filter((conversation) => conversation.ticket);

  dom.convStats.innerHTML = [
    statCard({
      label: "Conversations", value: String(summary.total),
      sub: `${summary.resolved} resolved · ${summary.escalated} handed off`,
    }),
    statCard({
      label: "Deflection rate", value: percent(summary.deflectionRate, 0), sub: "resolved without a human", tone: "green",
    }),
    statCard({
      label: "Hand-offs", value: String(summary.escalated), sub: `${summary.openTickets} open ticket${summary.openTickets === 1 ? "" : "s"}`, tone: "gold",
    }),
    statCard({
      label: "First reply p95", value: `${(summary.p95FirstResponseMs / 1000).toFixed(1)}s`,
      sub: `median ${(summary.p50FirstResponseMs / 1000).toFixed(1)}s simulated`,
    }),
  ].join("");

  dom.convCount.textContent = `${summary.total} conversations`;
  dom.ticketCount.textContent = `${summary.openTickets} open`;
  dom.navConvCount.textContent = String(summary.total);

  dom.convTable.querySelector("tbody").innerHTML = conversations.map((conversation) => {
    const last = lastAgentMessage(conversation);
    const first = conversation.messages.find((message) => message.role === "customer");
    return `
      <tr class="conv-row" data-conversation="${escapeHtml(conversation.id)}">
        <td><div class="customer-cell">
          <span class="avatar">${escapeHtml(conversation.customer.initials)}</span>
          <div><b>${escapeHtml(conversation.customer.name)}</b><span>${escapeHtml(conversation.channel)}</span></div>
        </div></td>
        <td class="question-cell"><span title="${escapeHtml(first?.text || "")}">${escapeHtml(first?.text || "—")}</span></td>
        <td>${confidencePill(last?.confidence?.score)}</td>
        <td>${conversation.ticket
          ? '<span class="badge red">Handed off</span>'
          : '<span class="badge green">Resolved</span>'}</td>
        <td class="num mono">${conversation.firstResponseMs ? `${(conversation.firstResponseMs / 1000).toFixed(2)}s` : "—"}</td>
      </tr>`;
  }).join("");

  dom.ticketsList.innerHTML = tickets.length
    ? tickets.map((conversation) => `
      <div class="ticket-item">
        <div class="row"><b>${escapeHtml(conversation.ticket.id)}</b><span class="badge red" style="margin-left:auto">${escapeHtml(conversation.ticket.status)}</span></div>
        <p>${escapeHtml(conversation.ticket.subject)}</p>
        <div class="meta">
          <span>${escapeHtml(conversation.ticket.queue)}</span>
          <span>·</span>
          <span>${conversation.ticket.messageCount} messages</span>
          <span>·</span>
          <span>SLA ${conversation.ticket.slaMinutes}m</span>
          <button class="btn sm" style="margin-left:auto;padding:2px 8px" data-open-ticket="${escapeHtml(conversation.id)}">Open</button>
        </div>
      </div>`).join("")
    : '<p class="small muted" style="margin:0">No tickets yet.</p>';

  const buckets = confidenceBuckets(conversations);
  const max = Math.max(1, buckets.high, buckets.medium, buckets.low);
  dom.confMix.innerHTML = [
    ["High", buckets.high, ""],
    ["Medium", buckets.medium, "medium"],
    ["Low", buckets.low, "low"],
  ].map(([label, count, tone]) => `
    <div class="conf-mix-row ${tone}">
      <span>${label}</span>
      <span class="bar"><i style="width:${Math.round((count / max) * 100)}%"></i></span>
      <b>${count}</b>
    </div>`).join("");
}

function renderEvaluation() {
  const result = state.evaluation || runEvaluation(agent);
  state.evaluation = result;
  const passed = result.rows.filter((row) => row.passed).length;

  dom.evalStats.innerHTML = [
    statCard({ label: "Hit@1", value: percent(result.hitAt1), sub: `${result.retrievalCases} retrieval labels`, tone: "green" }),
    statCard({ label: "Hit@3", value: percent(result.hitAt3), sub: "labelled article in top 3", tone: "green" }),
    statCard({ label: "Tool match", value: percent(result.toolAccuracy), sub: `${result.toolCases} tool decisions` }),
    statCard({ label: "Grounding", value: percent(result.groundingRate), sub: "citation matches label", tone: "green" }),
    statCard({ label: "Escalation", value: percent(result.escalationAccuracy), sub: `${result.escalated} out-of-scope rows`, tone: "green" }),
  ].join("");

  dom.evalPassRate.textContent = `${passed} / ${result.total} pass`;
  dom.evalPassRate.className = `badge ${passed === result.total ? "green" : "gold"}`;
  dom.evalSubtitle.textContent = `${result.total} questions · ${result.retrievalCases} retrieval labels · ${result.total - result.retrievalCases} out-of-scope`;
  dom.navEvalCount.textContent = String(result.total);

  dom.evalTable.querySelector("tbody").innerHTML = result.rows.map((row) => {
    const expected = row.expectedArticles.length
      ? row.expectedArticles.map((id) => `<span class="mono">${escapeHtml(id)}</span>`).join("")
      : '<span class="badge red" style="font-size:9px">hand off</span>';
    const top = row.topArticleId
      ? (ARTICLE_BY_ID.get(row.topArticleId)?.title || row.topArticleId)
      : "—";
    return `
      <tr>
        <td class="question-cell"><span title="${escapeHtml(row.question)}">${escapeHtml(row.question)}</span></td>
        <td><div class="expected">${expected}</div></td>
        <td>${escapeHtml(top)}</td>
        <td class="num mono">${percent(row.confidence)}</td>
        <td><span class="badge ${decisionTone(row.decision)}">${decisionLabel(row.decision)}</span></td>
        <td>${row.passed ? '<span class="badge green">pass</span>' : '<span class="badge red">fail</span>'}</td>
      </tr>`;
  }).join("");
}

function updateCounts() {
  dom.navConvCount.textContent = String(state.conversations.length);
  dom.navEvalCount.textContent = String((state.evaluation || runEvaluation(agent)).total);
}

function setView(view, { syncHash = true } = {}) {
  if (!VIEW_TITLES[view]) view = "chat";
  state.view = view;
  for (const panel of $$("[data-view-panel]")) {
    panel.classList.toggle("hide", panel.dataset.viewPanel !== view);
  }
  for (const link of $$("[data-nav]")) {
    link.classList.toggle("active", link.dataset.nav === view);
  }
  dom.crumb.textContent = VIEW_TITLES[view];
  if (view === "conversations") renderConversations();
  else if (view === "evaluation") renderEvaluation();
  else { renderChat(); renderTrace(); }
  if (syncHash && location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
}

function openConversation(id) {
  const conversation = state.conversations.find((entry) => entry.id === id);
  if (!conversation) return;
  state.chat = conversation;
  state.lastAgent = lastAgentMessage(conversation);
  setView("chat");
  A.toast?.(`Opened ${conversation.customer.name}'s conversation`, "info", 2000);
}

/* ------------------------------------------------------------------- wire */

function wire() {
  const navs = { chat: $("#nav-chat"), conversations: $("#nav-conversations"), evaluation: $("#nav-evaluation") };
  for (const [view, link] of Object.entries(navs)) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setView(view);
    });
  }

  dom.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(dom.chatInput.value);
  });

  const suggestions = {
    "suggest-order": "Where is LM-1048?",
    "suggest-refund": "Can I return an item after 30 days?",
    "suggest-address": "Can I change my delivery address?",
    "suggest-gift": "Do you gift-wrap orders?",
  };
  for (const [id, text] of Object.entries(suggestions)) {
    document.getElementById(id)?.addEventListener("click", () => sendMessage(text));
  }

  dom.transcript.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-cite]");
    if (!chip) return;
    const evidence = chip.closest(".evidence");
    const detail = evidence?.querySelector(`[data-detail="${chip.dataset.cite}"]`);
    if (!detail) return;
    detail.hidden = !detail.hidden;
    chip.classList.toggle("active", !detail.hidden);
  });

  dom.trace.addEventListener("click", (event) => {
    if (event.target.closest("#handoff-btn")) handOff();
  });

  $("#reset-chat").addEventListener("click", () => {
    state.conversations = state.conversations.filter((conversation) => conversation.id !== "conv-live");
    newChat();
    setView("chat");
    updateCounts();
    renderConversations();
    A.toast?.("Started a new chat", "success", 1800);
  });

  dom.convTable.addEventListener("click", (event) => {
    const row = event.target.closest("[data-conversation]");
    if (row) openConversation(row.dataset.conversation);
  });

  dom.ticketsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-ticket]");
    if (button) openConversation(button.dataset.openTicket);
  });

  $("#export-log").addEventListener("click", () => {
    const rows = state.conversations.map((conversation) => {
      const first = conversation.messages.find((message) => message.role === "customer");
      const last = lastAgentMessage(conversation);
      return {
        conversation: conversation.id,
        customer: conversation.customer.name,
        email: conversation.customer.email,
        question: first?.text || "",
        confidence: last?.confidence ? Number(last.confidence.score.toFixed(3)) : "",
        decision: last?.decision || "",
        outcome: conversation.ticket ? "handed off" : "resolved",
        ticket: conversation.ticket?.id || "",
        first_response_ms: conversation.firstResponseMs || "",
      };
    });
    A.download("relay-conversations.csv", A.toCSV(rows), "text/csv");
    A.toast?.("Conversation log exported as CSV", "success", 2200);
  });

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (VIEW_TITLES[hash] && hash !== state.view) setView(hash, { syncHash: false });
  });
}

/* ------------------------------------------------------------------ start */

newChat();
wire();
state.evaluation = runEvaluation(agent);
updateCounts();
renderConversations();
renderEvaluation();
const initialView = (() => {
  const hash = location.hash.replace("#", "");
  return VIEW_TITLES[hash] ? hash : "chat";
})();
setView(initialView, { syncHash: false });
