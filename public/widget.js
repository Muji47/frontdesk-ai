(function () {
  "use strict";

  // Prevent multiple initializations on the same page
  if (document.getElementById("echo-receptionist-widget")) return;
  window.__ECHO_WIDGET_INITIALIZED__ = true;

  // 1. Detect Host Origin & Organization ID from script attribute
  const scriptTag =
    document.currentScript ||
    document.querySelector("script[src*='widget.js']") ||
    document.querySelector("script[data-org]") ||
    document.querySelector("script[data-org-id]");

  const orgId =
    scriptTag?.getAttribute("data-org") ||
    scriptTag?.getAttribute("data-org-id") ||
    "org_demo_101";
  let hostUrl = "";
  try {
    if (scriptTag && scriptTag.src) {
      hostUrl = new URL(scriptTag.src).origin;
    } else {
      hostUrl = window.location.origin;
    }
  } catch {
    hostUrl = window.location.origin;
  }

  // 2. Create Isolated Shadow DOM Container
  const host = document.createElement("div");
  host.id = "echo-receptionist-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  // 3. Inject Scoped Styles into Shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .echo-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.38), 0 2px 6px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483640;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
      border: 2px solid rgba(255, 255, 255, 0.2);
    }

    .echo-launcher:hover {
      transform: scale(1.06);
      box-shadow: 0 12px 30px rgba(79, 70, 229, 0.48);
    }

    .echo-launcher:active {
      transform: scale(0.96);
    }

    .echo-launcher.echo-left {
      right: auto;
      left: 24px;
    }

    .echo-pulse-beacon {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      background: #10b981;
      border-radius: 50%;
      border: 2px solid #ffffff;
      animation: echo-pulse 2s infinite;
    }

    @keyframes echo-pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* Modal Window */
    .echo-modal {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 580px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 16px 48px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08);
      z-index: 2147483640;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      pointer-events: none;
      transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .echo-modal.echo-left {
      right: auto;
      left: 24px;
    }

    .echo-modal.echo-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    .echo-header {
      padding: 16px 18px;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .echo-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .echo-avatar {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1 0%, #38bdf8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 700;
      font-size: 15px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .echo-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }

    .echo-subtitle {
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 1px;
    }

    .echo-status-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
    }

    .echo-close-btn {
      background: rgba(255, 255, 255, 0.12);
      border: none;
      color: #cbd5e1;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background 0.15s, color 0.15s;
    }

    .echo-close-btn:hover {
      background: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }

    /* Messages Area */
    .echo-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    .echo-msg {
      max-width: 82%;
      padding: 11px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
      animation: echo-fadeIn 0.2s ease-out;
    }

    @keyframes echo-fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .echo-msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .echo-msg-user {
      align-self: flex-end;
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      color: #ffffff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
    }

    .echo-msg-author {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      opacity: 0.75;
    }

    .echo-msg-staff {
      align-self: flex-start;
      background: #ecfdf5;
      color: #064e3b;
      border: 1px solid #a7f3d0;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.08);
    }

    .echo-msg-staff .echo-msg-author {
      color: #047857;
      opacity: 1;
    }

    .echo-chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }

    .echo-chip {
      background: #ffffff;
      color: #4f46e5;
      border: 1px solid #c7d2fe;
      border-radius: 20px;
      padding: 5px 11px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .echo-chip:hover {
      background: #eef2ff;
      border-color: #818cf8;
      transform: translateY(-1px);
    }

    .echo-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 10px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      width: fit-content;
    }

    .echo-dot {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: echo-bounce 1.4s infinite ease-in-out both;
    }

    .echo-dot:nth-child(1) { animation-delay: -0.32s; }
    .echo-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes echo-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Footer & Input */
    .echo-footer {
      padding: 12px 14px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .echo-input-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f1f5f9;
      border-radius: 12px;
      padding: 4px 6px 4px 12px;
      border: 1px solid transparent;
      transition: border-color 0.2s, background 0.2s;
    }

    .echo-input-box:focus-within {
      background: #ffffff;
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }

    .echo-input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: #0f172a;
    }

    .echo-send-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: #4f46e5;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, opacity 0.15s;
    }

    .echo-send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .echo-send-btn:not(:disabled):hover {
      background: #4338ca;
    }

    .echo-branding {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }

    .echo-branding b {
      color: #6366f1;
    }

    /* Mobile Responsive */
    @media (max-width: 480px) {
      .echo-modal {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
      .echo-launcher {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  shadow.appendChild(style);

  // 4. Construct DOM Elements
  const container = document.createElement("div");
  container.innerHTML = `
    <!-- Floating Launcher -->
    <button class="echo-launcher" id="echoLauncher" aria-label="Open AI Receptionist Chat">
      <div class="echo-pulse-beacon"></div>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <path d="M16 4C9.37 4 4 9.37 4 16C4 18.23 4.61 20.32 5.67 22.12L4.5 27.5L10.04 26.36C11.8 27.39 13.84 28 16 28C22.63 28 28 22.63 28 16C28 9.37 22.63 4 16 4Z" fill="white" fill-opacity="0.16"/>
        <path d="M16 8C11.58 8 8 11.58 8 16C8 17.55 8.44 19 9.21 20.24L8.5 23.5L11.85 22.82C13.06 23.57 14.48 24 16 24C20.42 24 24 20.42 24 16C24 11.58 20.42 8 16 8Z" fill="white"/>
        <circle cx="12" cy="16" r="1.5" fill="#4f46e5"/>
        <circle cx="16" cy="16" r="1.5" fill="#4f46e5"/>
        <circle cx="20" cy="16" r="1.5" fill="#4f46e5"/>
      </svg>
    </button>

    <!-- Chat Modal Window -->
    <div class="echo-modal" id="echoModal" role="dialog" aria-modal="true" aria-label="Echo.ai Receptionist">
      <!-- Header -->
      <div class="echo-header">
        <div class="echo-header-left">
          <div class="echo-avatar" id="echoAvatar">M</div>
          <div>
            <div class="echo-title" id="echoAgentName">Maya · AI Receptionist</div>
            <div class="echo-subtitle">
              <span class="echo-status-dot"></span>
              <span id="echoClinicName">Healing Hands Physio • Online</span>
            </div>
          </div>
        </div>
        <button class="echo-close-btn" id="echoCloseBtn" aria-label="Close Chat">✕</button>
      </div>

      <!-- Messages Stream -->
      <div class="echo-messages" id="echoMessages">
        <!-- Rendered dynamically -->
      </div>

      <!-- Footer & Input -->
      <div class="echo-footer">
        <form class="echo-input-box" id="echoForm">
          <input 
            type="text" 
            class="echo-input" 
            id="echoInput" 
            placeholder="Type your question here..." 
            autocomplete="off" 
            required
          />
          <button type="submit" class="echo-send-btn" id="echoSendBtn" aria-label="Send Message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        <div class="echo-branding">
          Powered by <b>Echo.ai</b> • 24/7 Autonomous Front Desk
        </div>
      </div>
    </div>
  `;
  shadow.appendChild(container);

  // 5. DOM References inside Shadow Root
  const launcher = shadow.getElementById("echoLauncher");
  const modal = shadow.getElementById("echoModal");
  const closeBtn = shadow.getElementById("echoCloseBtn");
  const messagesBox = shadow.getElementById("echoMessages");
  const form = shadow.getElementById("echoForm");
  const input = shadow.getElementById("echoInput");
  const sendBtn = shadow.getElementById("echoSendBtn");
  const avatar = shadow.getElementById("echoAvatar");
  const agentNameEl = shadow.getElementById("echoAgentName");
  const clinicNameEl = shadow.getElementById("echoClinicName");

  let conversationId = sessionStorage.getItem(`echo_conv_${orgId}`) || null;
  const renderedIds = new Set();
  let isOpen = false;
  let isSending = false;
  let isSyncing = false;
  let agentConfig = {
    name: "Maya",
    greeting: "Hello! I'm Maya, your AI receptionist. How can I help you with appointments or clinic info today?",
    color: "#4f46e5",
    orgName: "Front Desk",
    chips: ["Book Appointment", "Consultation Fees", "HICAPS Health Funds", "Opening Hours"],
    position: "right",
  };

  // 6. Fetch Dynamic Organization Configuration
  async function loadConfig() {
    try {
      const res = await fetch(`${hostUrl}/api/widget/config?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        agentConfig = { ...agentConfig, ...data };
        applyConfig();
      }
    } catch (e) {
      console.warn("Echo.ai: using default config fallback", e);
      applyConfig();
    }
    if (conversationId) {
      syncMessages();
    }
  }

  function applyConfig() {
    avatar.textContent = (agentConfig.name || "M")[0].toUpperCase();
    agentNameEl.textContent = `${agentConfig.name} · AI Receptionist`;
    clinicNameEl.textContent = `${agentConfig.orgName} • Online`;

    if (agentConfig.position === "left") {
      launcher.classList.add("echo-left");
      modal.classList.add("echo-left");
    }

    if (agentConfig.color) {
      launcher.style.background = `linear-gradient(135deg, ${agentConfig.color} 0%, #0f172a 120%)`;
      avatar.style.background = agentConfig.color;
    }

    // Render initial greeting if messages are empty
    if (!messagesBox.children.length) {
      renderBotMessage(agentConfig.greeting, agentConfig.chips, "echo_greeting");
    }
  }

  function toggleModal() {
    isOpen = !isOpen;
    if (isOpen) {
      modal.classList.add("echo-open");
      input.focus();
      scrollToBottom();
    } else {
      modal.classList.remove("echo-open");
    }
  }

  launcher.addEventListener("click", toggleModal);
  closeBtn.addEventListener("click", toggleModal);

  function scrollToBottom() {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function renderBotMessage(text, chips, msgId) {
    if (msgId && renderedIds.has(msgId)) return;
    if (msgId) renderedIds.add(msgId);

    const msg = document.createElement("div");
    msg.className = "echo-msg echo-msg-bot";
    if (msgId) msg.dataset.msgId = msgId;

    const author = document.createElement("div");
    author.className = "echo-msg-author";
    author.textContent = agentConfig.name;
    msg.appendChild(author);

    const body = document.createElement("div");
    body.textContent = text;
    msg.appendChild(body);

    if (chips && chips.length > 0) {
      const chipsWrapper = document.createElement("div");
      chipsWrapper.className = "echo-chips-container";
      chips.forEach((chipText) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "echo-chip";
        chip.textContent = chipText;
        chip.addEventListener("click", () => {
          sendMessage(chipText);
        });
        chipsWrapper.appendChild(chip);
      });
      msg.appendChild(chipsWrapper);
    }

    messagesBox.appendChild(msg);
    scrollToBottom();
  }

  function renderStaffMessage(text, msgId) {
    if (msgId && renderedIds.has(msgId)) return;
    if (msgId) renderedIds.add(msgId);

    const msg = document.createElement("div");
    msg.className = "echo-msg echo-msg-staff";
    if (msgId) msg.dataset.msgId = msgId;

    const author = document.createElement("div");
    author.className = "echo-msg-author";
    author.textContent = "👩‍⚕️ Front Desk Staff • Live Reply";
    msg.appendChild(author);

    const body = document.createElement("div");
    body.textContent = text;
    msg.appendChild(body);

    messagesBox.appendChild(msg);
    scrollToBottom();

    // Automatically open drawer if closed when live staff replies
    if (!isOpen) {
      isOpen = true;
      modal.classList.add("echo-open");
    }
  }

  function renderUserMessage(text, msgId) {
    if (msgId && renderedIds.has(msgId)) return null;
    if (msgId) renderedIds.add(msgId);

    const msg = document.createElement("div");
    msg.className = "echo-msg echo-msg-user";
    if (msgId) msg.dataset.msgId = msgId;
    msg.textContent = text;
    messagesBox.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function showTypingIndicator() {
    const typing = document.createElement("div");
    typing.className = "echo-typing";
    typing.id = "echoTypingIndicator";
    typing.innerHTML = '<div class="echo-dot"></div><div class="echo-dot"></div><div class="echo-dot"></div>';
    messagesBox.appendChild(typing);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const typing = shadow.getElementById("echoTypingIndicator");
    if (typing) typing.remove();
  }

  // Real-time synchronization for live staff replies & session history
  async function syncMessages() {
    if (!conversationId || isSyncing || isSending) return;
    isSyncing = true;
    try {
      const res = await fetch(
        `${hostUrl}/api/widget/messages?conversationId=${encodeURIComponent(conversationId)}&orgId=${encodeURIComponent(orgId)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          data.messages.forEach((m) => {
            if (!renderedIds.has(m.id)) {
              if (m.sender === "client") {
                renderUserMessage(m.content, m.id);
              } else if (m.sender === "staff") {
                renderStaffMessage(m.content, m.id);
              } else if (m.sender === "ai") {
                renderBotMessage(m.content, null, m.id);
              }
            }
          });
        }
      } else if (res.status === 404) {
        // Conversation was cleared/deleted from DB
        sessionStorage.removeItem(`echo_conv_${orgId}`);
        conversationId = null;
      }
    } catch (e) {
      // Silent retry on next interval
    } finally {
      isSyncing = false;
    }
  }

  function extractHostPageContext() {
    try {
      const sections = [];
      const hero = document.querySelector(".hero");
      if (hero) {
        const h1 = hero.querySelector("h1, h2")?.innerText?.trim() || "Overview & Pricing";
        const text = hero.innerText?.replace(/\s+/g, " ").trim() || "";
        if (text) sections.push({ title: h1, content: text });
      }

      const cards = document.querySelectorAll(".card, section, article");
      cards.forEach((el) => {
        if (el.closest("#echo-receptionist-widget") || el.classList.contains("sandbox-banner")) return;
        const heading = el.querySelector("h1, h2, h3, h4")?.innerText?.trim() || "Website Section";
        const text = el.innerText?.replace(/\s+/g, " ").trim() || "";
        if (text && text.length > 15 && text.length < 1500) {
          sections.push({ title: heading, content: text });
        }
      });

      if (sections.length === 0 && document.body) {
        const clone = document.body.cloneNode(true);
        const widgetEl = clone.querySelector("#echo-receptionist-widget");
        if (widgetEl) widgetEl.remove();
        clone.querySelectorAll("script, style, noscript").forEach((s) => s.remove());
        const rawText = (clone.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2500);
        if (rawText) {
          sections.push({ title: document.title || "Website Content", content: rawText });
        }
      }

      return {
        url: window.location.origin + window.location.pathname,
        title: document.title || window.location.hostname,
        sections: sections.slice(0, 12),
      };
    } catch {
      return null;
    }
  }

  async function sendMessage(text) {
    const trimmed = (text || "").trim();
    if (!trimmed || isSending) return;

    const userMsgEl = renderUserMessage(trimmed, null);
    input.value = "";
    isSending = true;
    sendBtn.disabled = true;
    showTypingIndicator();

    try {
      const res = await fetch(`${hostUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId,
          orgId,
          visitorName: "Website Visitor (" + window.location.hostname + ")",
          pageContext: extractHostPageContext(),
        }),
      });

      removeTypingIndicator();

      if (res.ok) {
        const data = await res.json();
        if (data.conversationId) {
          conversationId = data.conversationId;
          sessionStorage.setItem(`echo_conv_${orgId}`, conversationId);
        }
        if (data.clientMsgId) {
          renderedIds.add(data.clientMsgId);
          if (userMsgEl) userMsgEl.dataset.msgId = data.clientMsgId;
        }
        if (data.replyText) {
          renderBotMessage(data.replyText, data.chips, data.aiMsgId);
        }
      } else {
        renderBotMessage("I'm sorry, I'm temporarily having trouble connecting. Our front desk team has been notified.", null);
      }
    } catch (err) {
      removeTypingIndicator();
      console.error("Echo.ai send error:", err);
      renderBotMessage("I apologize, but our network connection timed out. Please try again or call our clinic directly.", null);
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  // Poll every 2 seconds for real-time staff replies from the Dashboard
  setInterval(syncMessages, 2000);

  // Start initialization
  loadConfig();
})();
