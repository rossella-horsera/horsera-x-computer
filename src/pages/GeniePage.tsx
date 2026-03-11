import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { activeThread } from "@/lib/developmentThread";
import { useToast } from "@/hooks/use-toast";

const GENIE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/genie-chat`;

const threadSuggestions = [
  `Why am I struggling with core engagement?`,
  `What should I work on this week?`,
  `Summarize my ${activeThread.goal} journey`,
  `How is my rhythm control trending?`,
];

type Message = { role: "user" | "assistant"; content: string };

const GeniePage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(GENIE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error || `Error ${resp.status}`;
        toast({ title: "Genie unavailable", description: errMsg, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        const current = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
          }
          return [...prev, { role: "assistant", content: current }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("Genie stream error:", e);
      toast({ title: "Connection error", description: "Could not reach Genie. Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] pt-14">
      <div className="px-6 pb-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sage-light flex items-center justify-center animate-pulse-glow">
            <Sparkles size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground">Genie</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your riding intelligence
            </p>
          </div>
        </motion.div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-3">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center gap-5 py-8">
              <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center">
                <Sparkles size={24} className="text-primary" />
              </div>
              <div>
                <p className="font-display text-xl font-semibold text-foreground">Ask about your journey</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-[260px]">
                  I know your goals, rides, skills & trainer feedback — ask me anything
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-2">
                {threadSuggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s)} className="text-left text-sm glass-card px-3.5 py-2.5 text-foreground active:scale-[0.98] transition-transform">
                    {s}
                  </button>
                ))}
              </div>
              <div className="glass-card p-4 mt-2 w-full max-w-xs border-l-2 border-l-accent">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You've done 3 rides without trainer review — consider requesting feedback from Emma.
                </p>
              </div>
            </motion.div>
          ) : (
            messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "glass-card text-foreground rounded-bl-md"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      <Sparkles size={10} /> AI coach · grounded in your data
                    </div>
                  )}
                  {msg.content}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          </motion.div>
        )}
      </div>

      <div className="px-6 py-3">
        <div className="flex items-center gap-2.5 glass-card px-4 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about your training..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isLoading}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || isLoading} className="w-8 h-8 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-30 transition-opacity">
            <ArrowUp size={16} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeniePage;
