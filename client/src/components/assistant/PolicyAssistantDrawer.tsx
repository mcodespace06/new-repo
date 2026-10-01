import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  RefreshCw, 
  PhoneCall, 
  BookOpen, 
  ArrowRight,
  FileText,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citations?: string[];
  crisis?: boolean;
  emergencyContacts?: Array<{ name: string; number: string; description: string; tollFree: boolean }>;
}

interface PolicyAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onFileComplaint?: () => void;
  onTriggerSos?: () => void;
  initialQuery?: string;
}

const SUGGESTED_PROMPTS = [
  'What is the penalty for ragging or bullying?',
  'What are the hostel curfew hours and late pass rules?',
  'How do I file a confidential harassment complaint?',
  'Can security or staff inspect personal belongings?',
];

export default function PolicyAssistantDrawer({
  isOpen,
  onClose,
  onFileComplaint,
  onTriggerSos,
  initialQuery = '',
}: PolicyAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        'Hello! I am your **Campus Policy & Student Rights Assistant**.\n\nAsk me anything regarding campus regulations, anti-ragging bylaws, hostel timings, or disciplinary policies. My answers are strictly cited from official university documents.',
      citations: ['University Handbook › General Guidelines'],
    },
  ]);
  const [input, setInput] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialQuery && isOpen) {
      setInput(initialQuery);
    }
  }, [initialQuery, isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('cv_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/rules/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: textToSend.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: 'asst-' + Date.now(),
          sender: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          crisis: data.crisis,
          emergencyContacts: data.emergencyContacts,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: 'err-' + Date.now(),
            sender: 'assistant',
            content: 'Sorry, I encountered an issue checking the regulations. Please try again or consult the administration.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'assistant',
          content: 'Network connection error. Please verify your connection.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-sky-50 to-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <span>Campus Policy Assistant</span>
                <span className="text-[10px] bg-sky-200 text-sky-800 font-bold px-1.5 py-0.5 rounded-full">
                  RAG Gemini
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Ground Truth Student Rights & Codes</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-sky-700 text-white rounded-br-none'
                      : m.crisis
                      ? 'bg-red-50 border-2 border-red-300 text-red-950 rounded-bl-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                  }`}
                >
                  {/* Crisis Banner if triggered */}
                  {m.crisis && (
                    <div className="mb-3 p-3 bg-red-600 text-white rounded-xl space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-amber-300" />
                        <span>Immediate Crisis Support Activated</span>
                      </div>
                      <p className="text-[11px] leading-tight opacity-95">
                        Please reach out immediately. Help is completely confidential and available right now.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                          href="tel:112"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-red-700 font-extrabold text-xs shadow-sm hover:bg-red-50 transition-colors"
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Call 112 Speed-Dial
                        </a>
                        {onTriggerSos && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onTriggerSos();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white font-extrabold text-xs shadow-sm transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                            <span>Trigger Emergency SOS</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Crisis Emergency Contacts Cards */}
                  {m.emergencyContacts && m.emergencyContacts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-200 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block">
                        Verified Helplines:
                      </span>
                      {m.emergencyContacts.slice(0, 3).map((c, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center bg-white/80 p-2 rounded-lg border border-red-100 text-[11px]"
                        >
                          <span className="font-semibold text-slate-900">{c.name}</span>
                          <a
                            href={`tel:${c.number.replace(/\s+/g, '')}`}
                            className="font-mono font-bold text-red-700 underline"
                          >
                            {c.number}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Official Rule Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                      <BookOpen className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Source:</span>
                      {m.citations.map((cite, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                        >
                          <FileText className="w-2.5 h-2.5 text-sky-600" />
                          {cite}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 max-w-[70%] text-xs text-slate-500 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
              <span>Checking campus bylaws & regulations...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggested Prompts Pill Bar */}
        <div className="p-2.5 bg-slate-100/80 border-t border-slate-200 overflow-x-auto whitespace-nowrap flex gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 transition-colors shadow-2xs font-medium inline-block shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a policy, disciplinary action, or student rights..."
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Fallback to File Complaint shortcut */}
          {onFileComplaint && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Experiencing an issue that violates regulations?</span>
              <button
                onClick={() => {
                  onClose();
                  onFileComplaint();
                }}
                className="text-sky-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                File Report <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
