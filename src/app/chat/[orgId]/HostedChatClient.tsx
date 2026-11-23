"use strict";
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Message {
  id: string;
  sender: "client" | "ai";
  content: string;
  time: string;
  chips?: string[];
}

interface HostedChatClientProps {
  orgId: string;
  orgName: string;
  agentName: string;
  greeting: string;
  brandColor: string;
  industry: string;
  defaultChips: string[];
}

export function HostedChatClient({
  orgId,
  orgName,
  agentName,
  greeting,
  brandColor,
  industry,
  defaultChips,
}: HostedChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize conversation and load greeting
  useEffect(() => {
    const storedConv = sessionStorage.getItem(`echo_hosted_conv_${orgId}`);
    if (storedConv) {
      setConversationId(storedConv);
    }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages([
      {
        id: "msg_init",
        sender: "ai",
        content: greeting,
        time: now,
        chips: defaultChips,
      },
    ]);
  }, [orgId, greeting, defaultChips]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleCopyShareLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${agentName} — ${orgName} AI Receptionist`,
          text: `Chat with ${agentName}, virtual front desk receptionist at ${orgName}.`,
          url: window.location.href,
        });
      } catch {
        handleCopyShareLink();
      }
    } else {
      handleCopyShareLink();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = {
      id: "usr_" + Date.now(),
      sender: "client",
      content: text,
      time: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          conversationId: conversationId || undefined,
          message: text,
          visitorName: "Direct Link Visitor",
          pageContext: {
            title: `${orgName} Hosted AI Receptionist`,
            url: typeof window !== "undefined" ? window.location.href : "",
          },
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      if (res.ok && data.success) {
        if (data.conversationId) {
          setConversationId(data.conversationId);
          sessionStorage.setItem(`echo_hosted_conv_${orgId}`, data.conversationId);
        }

        const aiMsg: Message = {
          id: data.aiMsgId || "ai_" + Date.now(),
          sender: "ai",
          content: data.replyText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          chips: data.chips,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errorMsg: Message = {
          id: "err_" + Date.now(),
          sender: "ai",
          content:
            data.error?.message ||
            "I am currently having difficulty connecting to our front desk server. Please try again shortly.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      setIsTyping(false);
      const networkErrorMsg: Message = {
        id: "err_net_" + Date.now(),
        sender: "ai",
        content: "Network connection timed out. Please check your connection and try again.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, networkErrorMsg]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 font-sans text-slate-800 selection:bg-indigo-100">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {agentName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                {agentName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online 24/7
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Virtual Front Desk • {orgName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Share button */}
          <button
            onClick={handleNativeShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Share this receptionist link"
          >
            {copiedLink ? (
              <>
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Share Link</span>
              </>
            )}
          </button>

          <Link
            href="/"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition"
          >
            Echo.ai ↗
          </Link>
        </div>
      </header>

      {/* Main Chat Stream */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-3xl w-full mx-auto">
        <div className="text-center py-2">
          <span className="inline-block px-3 py-1 bg-white/80 border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-500 shadow-2xs">
            Direct Receptionist Portal • Powered by Echo.ai
          </span>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "client" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
              {msg.sender === "ai" && (
                <div
                  className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 mb-1 shadow-2xs"
                  style={{ backgroundColor: brandColor }}
                >
                  {agentName.charAt(0)}
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                  msg.sender === "client"
                    ? "bg-slate-900 text-white rounded-br-xs"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    msg.sender === "client" ? "text-slate-400" : "text-slate-400"
                  }`}
                >
                  {msg.time}
                </span>
              </div>
            </div>

            {/* Quick Action Suggestion Chips */}
            {msg.chips && msg.chips.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 pl-9 max-w-[85%]">
                {msg.chips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-end gap-2 items-start">
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 mb-1"
              style={{ backgroundColor: brandColor }}
            >
              {agentName.charAt(0)}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Box Footer */}
      <footer className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 shadow-lg z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agentName} anything about ${orgName}...`}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isTyping}
            style={{ backgroundColor: inputValue.trim() && !isTyping ? brandColor : undefined }}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition flex items-center justify-center shrink-0 shadow-sm ${
              inputValue.trim() && !isTyping
                ? "hover:opacity-95 cursor-pointer"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            <span>Send</span>
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

        <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Replies instantly in real-time</span>
          <Link href="/" className="hover:text-slate-600 transition">
            Powered by Echo.ai
          </Link>
        </div>
      </footer>
    </div>
  );
}
