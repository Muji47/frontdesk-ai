"use client";

import { useEffect, useRef, useState } from "react";
import type { Industry } from "@/content/industries";

type Msg =
  | { from: "bot"; text: string; chips?: string[]; card?: { title: string; lines: string[]; badge?: string } }
  | { from: "user"; text: string };

export function DemoWidget({ cfg }: { cfg: Industry }) {
  const d = cfg.demo;
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: d.greeting, chips: d.chips }]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  function reply(q: string): Msg {
    const t = q.toLowerCase();
    if (/(human|person|agent|staff|someone|team member)/.test(t) && !d.replies.some((r) => r.match.some((m) => t.includes(m)))) {
      return { from: "bot", text: d.handover };
    }
    const hit = d.replies.find((r) => r.match.some((m) => t.includes(m)));
    if (hit) return { from: "bot", text: hit.text, chips: hit.chips, card: hit.card };
    if (/(human|person|agent|staff|someone)/.test(t)) return { from: "bot", text: d.handover };
    return { from: "bot", text: d.fallback, chips: ["Talk to a person"] };
  }

  function send(q: string) {
    q = q.trim();
    if (!q || typing) return;
    setInput("");
    // remove chips from earlier messages so only the latest are tappable
    setMsgs((m) => [...m.map((x) => (x.from === "bot" ? { ...x, chips: undefined } : x)), { from: "user", text: q }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, reply(q)]);
    }, 800);
  }

  return (
    <div className="flex h-[480px] w-full max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="accent-bg flex items-center gap-3 px-4 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 font-bold">{d.agent[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{d.site}</div>
          <div className="text-xs opacity-90">{d.agent} · AI assistant · Online</div>
        </div>
      </div>

      <div ref={box} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 text-[13px]">
        {msgs.map((m, i) =>
          m.from === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="accent-bg max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-white">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-2.5">{m.text}</div>
              {m.card && (
                <div className="max-w-[88%] rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-xs">{m.card.title}</b>
                    {m.card.badge && <span className="accent-soft accent-text rounded-full px-2 py-0.5 text-xs font-semibold">{m.card.badge}</span>}
                  </div>
                  {m.card.lines.map((l) => (
                    <div key={l} className="mt-1 text-xs text-slate-500">{l}</div>
                  ))}
                </div>
              )}
              {m.chips && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {m.chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => send(c)}
                      className="accent-text rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:bg-white"
                      style={{ borderColor: "var(--accent)" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {typing && (
          <div className="w-14 rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-2.5">
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
        )}
      </div>

      <div className="px-3 pt-2 text-xs text-slate-400">You’re chatting with an AI assistant.</div>
      <form
        className="flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button className="accent-bg rounded-lg px-3 font-bold text-white" aria-label="Send">➤</button>
      </form>
    </div>
  );
}
