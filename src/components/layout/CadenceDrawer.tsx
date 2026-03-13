import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'cadence' | 'rider';
  text: string;
  timestamp: string;
}

interface UsageStats {
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
}

const suggestedPrompts = [
  'What should I focus on in my next ride?',
  'Why do I keep losing my right stirrup?',
  'Am I ready for the Spring Classic?',
  'Explain my lower leg stability score',
];

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

// Simple markdown rendering for chat messages
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

interface CadenceDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CadenceDrawer({ open, onClose }: CadenceDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'cadence',
      text: "Hi Rossella. I've been watching your recent rides. Your rein steadiness has improved noticeably — and your lower leg is your current focus. What's on your mind today?",
      timestamp: 'Now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch usage stats when drawer opens
  useEffect(() => {
    if (open) {
      fetch(`${API_BASE}/api/cadence/usage`)
        .then(r => r.json())
        .then(setUsage)
        .catch(() => {});
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const now = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

    // Add rider message
    const riderMsg: Message = { role: 'rider', text, timestamp: now };
    setMessages(prev => [...prev, riderMsg]);
    setInput('');
    setIsStreaming(true);
    setRateLimitMsg(null);

    // Build conversation history for the API
    const allMessages = [...messages, riderMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'rider' ? 'user' : 'assistant',
      content: m.text,
    }));

    try {
      const response = await fetch(`${API_BASE}/api/cadence/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (response.status === 429) {
        const err = await response.json();
        setRateLimitMsg(err.detail?.message || 'You have reached your message limit. Please try again later.');
        setIsStreaming(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Start with empty cadence message
      const cadenceMsg: Message = { role: 'cadence', text: '', timestamp: now };
      setMessages(prev => [...prev, cadenceMsg]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'cadence') {
                  updated[updated.length - 1] = { ...last, text: last.text + parsed.text };
                }
                return updated;
              });
            } else if (parsed.type === 'usage') {
              setUsage({
                daily_used: parsed.daily_used,
                daily_limit: parsed.daily_limit,
                monthly_used: parsed.monthly_used,
                monthly_limit: parsed.monthly_limit,
              });
            } else if (parsed.type === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'cadence') {
                  updated[updated.length - 1] = { ...last, text: "I'm having trouble connecting right now. Please try again in a moment." };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      // Fallback to mock response if API is unavailable
      const fallback = getFallbackResponse(text);
      setMessages(prev => {
        // Check if there's already an empty cadence msg from streaming attempt
        const last = prev[prev.length - 1];
        if (last.role === 'cadence' && last.text === '') {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text: fallback };
          return updated;
        }
        return [...prev, { role: 'cadence', text: fallback, timestamp: now }];
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  // Voice input handling
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        // For now, voice input creates a placeholder — real STT would go here
        setInput(prev => prev || '(Voice message — transcription coming soon)');
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      // Microphone not available
    }
  }, [isRecording]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,20,14,0.4)',
          zIndex: 70,
          transition: 'opacity 0.2s ease',
        }}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          height: '78%',
          background: '#FAF7F3',
          borderRadius: '28px 28px 0 0',
          zIndex: 80,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '4px' }}>
          <div style={{ width: '36px', height: '4px', background: '#EDE7DF', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '12px 20px 14px',
          borderBottom: '1px solid #EDE7DF',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {/* Waveform icon in header (matches FAB) */}
          <div style={{
            width: '36px', height: '36px',
            borderRadius: '50%',
            background: '#1C1510',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5px' }}>
              <div style={{ width: '2.5px', height: '8px', borderRadius: '1.5px', background: 'linear-gradient(180deg, #E2C384, #C9A96E)' }} />
              <div style={{ width: '2.5px', height: '12px', borderRadius: '1.5px', background: 'linear-gradient(180deg, #E2C384, #C9A96E)' }} />
              <div style={{ width: '2.5px', height: '10px', borderRadius: '1.5px', background: 'linear-gradient(180deg, #E2C384, #C9A96E)' }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 600, color: '#1A140E' }}>Cadence</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#B5A898' }}>Your intelligent riding advisor</div>
          </div>

          {/* Usage indicator */}
          {usage && (
            <div style={{
              fontSize: '9px',
              fontFamily: "'DM Mono', monospace",
              color: usage.daily_used > usage.daily_limit * 0.8 ? '#C4714A' : '#B5A898',
              textAlign: 'right',
              marginRight: 8,
            }}>
              {usage.daily_used}/{usage.daily_limit} today
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', color: '#B5A898', fontSize: '20px', lineHeight: 1,
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Rate limit banner */}
        {rateLimitMsg && (
          <div style={{
            padding: '10px 20px',
            background: 'rgba(196,113,74,0.08)',
            borderBottom: '1px solid rgba(196,113,74,0.15)',
            fontSize: '12px',
            color: '#C4714A',
            fontFamily: "'DM Sans', sans-serif",
            textAlign: 'center',
          }}>
            {rateLimitMsg}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'rider' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'cadence' && (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1C1510', flexShrink: 0, marginRight: 8, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5px' }}>
                    <div style={{ width: '2px', height: '5px', borderRadius: '1px', background: '#C9A96E' }} />
                    <div style={{ width: '2px', height: '8px', borderRadius: '1px', background: '#C9A96E' }} />
                    <div style={{ width: '2px', height: '6px', borderRadius: '1px', background: '#C9A96E' }} />
                  </div>
                </div>
              )}
              <div
                style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'rider' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  background: msg.role === 'rider' ? '#8C5A3C' : '#F1F4FA',
                  color: msg.role === 'rider' ? '#FAF7F3' : '#1A140E',
                  fontSize: '13.5px',
                  lineHeight: 1.55,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                {/* Streaming cursor */}
                {isStreaming && i === messages.length - 1 && msg.role === 'cadence' && (
                  <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>▊</span>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator when streaming hasn't started yet */}
          {isStreaming && messages[messages.length - 1]?.role === 'rider' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1C1510', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5px' }}>
                  <div style={{ width: '2px', height: '5px', borderRadius: '1px', background: '#C9A96E' }} />
                  <div style={{ width: '2px', height: '8px', borderRadius: '1px', background: '#C9A96E' }} />
                  <div style={{ width: '2px', height: '6px', borderRadius: '1px', background: '#C9A96E' }} />
                </div>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px', background: '#F1F4FA', display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7FA3', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length < 3 && (
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestedPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMessage(p)}
                style={{
                  background: '#F0EBE4',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  color: '#7A6B5D',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{
          padding: '12px 16px 24px',
          borderTop: '1px solid #EDE7DF',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          background: '#FAF7F3',
        }}>
          {/* Voice button */}
          <button
            onClick={toggleRecording}
            style={{
              width: 40, height: 40,
              borderRadius: '50%',
              background: isRecording ? '#C4714A' : '#F0EBE4',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="8" y="2" width="8" height="12" rx="4" fill={isRecording ? '#FAF7F3' : '#7A6B5D'} />
              <path d="M5 11C5 14.87 8.13 18 12 18C15.87 18 19 14.87 19 11" stroke={isRecording ? '#FAF7F3' : '#7A6B5D'} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="22" stroke={isRecording ? '#FAF7F3' : '#7A6B5D'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask Cadence anything..."
            disabled={isStreaming}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1.5px solid #EDE7DF',
              background: '#FFFFFF',
              fontSize: '14px',
              color: '#1A140E',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
              opacity: isStreaming ? 0.6 : 1,
            }}
          />

          {/* Attachment button */}
          <button
            onClick={() => {
              // Placeholder for file attachment
            }}
            style={{
              width: 40, height: 40,
              borderRadius: '50%',
              background: '#F0EBE4',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="#7A6B5D" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            style={{
              width: 40, height: 40,
              borderRadius: '50%',
              background: input.trim() && !isStreaming ? '#8C5A3C' : '#F0EBE4',
              border: 'none',
              cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke={input.trim() && !isStreaming ? '#FAF7F3' : '#B5A898'} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <style>{`
          @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
          }
          @keyframes blink {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0; }
          }
        `}</style>
      </div>
    </>
  );
}

// Fallback when API is unavailable
function getFallbackResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('focus') || q.includes('next ride')) {
    return "Based on your last 3 rides, I'd focus on your lower leg stability — specifically the right-rein drift we've been seeing. Try the two-point transitions before each canter. You have a lesson this afternoon, so this is a good thing to mention to Sarah.";
  }
  if (q.includes('stirrup') || q.includes('right')) {
    return "The right stirrup pattern is interesting — it shows up consistently across 4 of your last 5 rides. It's often linked to a subtle rightward hip collapse. Your pelvis levelness score confirms this. The good news: your core stability is mastered, so you have the foundation to fix it. Try this: in your next ride, consciously weight the right stirrup in every downward transition.";
  }
  if (q.includes('ready') || q.includes('spring classic') || q.includes('show')) {
    return "You have 21 days until the Spring Classic — that's actually a good amount of time. Your core stability is mastered, and rein steadiness is consolidating well (4/5 rides consistent). Lower leg stability is your main wild card at 3/5 rides. If you ride 4 times this week with intentional focus on the lower leg, I'd rate your readiness as 'nearly there' by show week.";
  }
  if (q.includes('lower leg') || q.includes('stability score')) {
    return "Your lower leg stability score is 72% — that's in the 'slight movement' range, improving from 55% six weeks ago. The score measures how much your ankle drifts relative to your hip over time. The drift is mainly on the right rein and in transitions. The stirrup-less work you've been doing is helping — it's showing in the trend.";
  }
  return "That's a great question. Based on your recent rides and your current focus on Training Level Test 1, I'd approach it this way: your strongest area right now is core stability, so use that as your anchor point. Build everything else from a solid seat outward. Is there a specific part of your training you'd like to dig into?";
}
