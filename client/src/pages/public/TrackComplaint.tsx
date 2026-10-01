import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Shield, 
  Clock, 
  MapPin, 
  Tag, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Calendar,
  MessageSquare,
  Send,
  Lock,
  Info
} from 'lucide-react';

interface EventItem {
  id: string;
  type: string;
  actorRole: string | null;
  payload: any;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  senderType: 'STAFF' | 'COMPLAINANT';
  senderRole?: string | null;
  content: string;
  requestInfo: boolean;
  createdAt: string;
}

interface ComplaintDetails {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  pseudonym: string;
  incidentAt: string;
  mode: string;
  createdAt: string;
  resolvedAt?: string | null;
  category: { name: string };
  location: { name: string };
  attachments?: Array<{ id: string; fileKey: string; mime: string; size: number }>;
}

interface TrackComplaintProps {
  initialKey?: string;
  onBack: () => void;
}

const STATUS_STEPS = ['SUBMITTED', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED'];

export default function TrackComplaint({ initialKey = '', onBack }: TrackComplaintProps) {
  const [keyInput, setKeyInput] = useState(initialKey);
  const [complaint, setComplaint] = useState<ComplaintDetails | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CHAT'>('OVERVIEW');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const fetchCase = async (searchKey: string) => {
    if (!searchKey) return;
    setError(null);
    setLoading(true);

    try {
      const cleanKey = searchKey.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Complaint not found. Verify the tracking key.');
      }

      setComplaint(data.complaint);

      // Fetch timeline events
      const eventsRes = await fetch(`/api/track/${cleanKey}/events`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }

      // Fetch initial chat messages
      const msgsRes = await fetch(`/api/track/${cleanKey}/messages`);
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        setMessages(msgsData.messages || []);
      }
    } catch (err: any) {
      setError(err.message);
      setComplaint(null);
      setEvents([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialKey) {
      fetchCase(initialKey);
    }
  }, [initialKey]);

  // Setup SSE stream for chat when complaint is loaded
  useEffect(() => {
    if (!complaint || !keyInput) return;
    const cleanKey = keyInput.trim().toUpperCase();
    const eventSource = new EventSource(`/api/track/${cleanKey}/messages/stream`);

    eventSource.addEventListener('message', (e) => {
      try {
        const newMsg = JSON.parse(e.data);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('status_change', (e) => {
      try {
        const statusData = JSON.parse(e.data);
        setComplaint((prev) => (prev ? { ...prev, status: statusData.status } : prev));
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [complaint?.id, keyInput]);

  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCase(keyInput);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !keyInput) return;

    setSendingMessage(true);
    try {
      const cleanKey = keyInput.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatInput.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setChatInput('');
        // If status was NEEDS_INFO, update to IN_PROGRESS locally
        if (complaint && complaint.status === 'NEEDS_INFO') {
          setComplaint({ ...complaint, status: 'IN_PROGRESS' });
        }
      }
    } catch {
      // ignore
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'IN_PROGRESS':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'NEEDS_INFO':
        return 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse';
      case 'TRIAGED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FLAGGED_REVIEW':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      {/* Tracker Search Box */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 mb-8">
        <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-2">
          <Search className="w-4 h-4" />
          <span>Case Lookup by Tracking Key</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">Track Complaint</h1>
        <p className="text-xs sm:text-sm text-slate-500 mb-6">
          Enter your <code>CV-YYMM-XXXX-XXXX</code> key to check case progress, status changes, and communicate with investigators anonymously.
        </p>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
            placeholder="CV-2610-A1B2-C3D4"
            className="flex-1 px-4 py-3 text-base font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent tracking-wider uppercase font-semibold"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Lookup Case</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Case Details View */}
      {complaint && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Action Needed Banner if NEEDS_INFO */}
          {complaint.status === 'NEEDS_INFO' && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-start gap-3 shadow-sm">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-bold text-sm text-amber-950 mb-0.5">Additional Information Requested</div>
                <p className="text-amber-800 leading-relaxed mb-2">
                  The case handler has asked clarifying questions. Check the <strong>Anonymous Chat</strong> tab below to reply. Replying will automatically transition the status to <strong>In Progress</strong>.
                </p>
                <button
                  onClick={() => setActiveTab('CHAT')}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Open Anonymous Chat
                </button>
              </div>
            </div>
          )}

          {/* Main Case Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6 mb-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(complaint.status)}`}>
                    Status: {complaint.status}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    Priority: {complaint.priority}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 text-xs font-semibold">
                    Mode: {complaint.mode}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{complaint.title}</h2>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-400 block">Pseudonym</span>
                <span className="text-sm font-bold text-sky-700 font-mono">{complaint.pseudonym}</span>
              </div>
            </div>

            {/* Stepper Bar */}
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">Lifecycle Progress</span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {STATUS_STEPS.map((step, idx) => {
                  const currentIdx = STATUS_STEPS.indexOf(complaint.status);
                  const isDone = currentIdx >= idx;
                  const isCurrent = complaint.status === step;
                  return (
                    <div key={step} className="space-y-1.5">
                      <div
                        className={`h-2 rounded-full transition-colors ${
                          isDone ? 'bg-sky-600' : 'bg-slate-200'
                        }`}
                      />
                      <span className={`block font-semibold ${isCurrent ? 'text-sky-700' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Tabs between Overview and Anonymous Chat */}
            <div className="flex border-b border-slate-200 mb-6">
              <button
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'OVERVIEW'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Details & Timeline</span>
              </button>

              <button
                onClick={() => setActiveTab('CHAT')}
                className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'CHAT'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Anonymous Chat with Staff</span>
                {messages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
                    {messages.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: OVERVIEW */}
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Metadata Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Category:</span>
                    <strong className="text-slate-900">{complaint.category.name}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Location:</span>
                    <strong className="text-slate-900">{complaint.location.name}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Incident:</span>
                    <strong className="text-slate-900">{new Date(complaint.incidentAt).toLocaleDateString()}</strong>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-2">Reported Incident Description</span>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {complaint.description}
                  </div>
                </div>

                {/* Evidence Attachments */}
                {complaint.attachments && complaint.attachments.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-2">Submitted Evidence</span>
                    <div className="flex flex-wrap gap-2">
                      {complaint.attachments.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200"
                        >
                          <Shield className="w-3.5 h-3.5 text-sky-700" />
                          Sanitized File ({att.mime.split('/')[1] || 'doc'})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline Events Log */}
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-700" />
                    Audit Timeline of Case Events
                  </h3>

                  {events.length === 0 ? (
                    <p className="text-xs text-slate-500">No events recorded yet.</p>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 ml-4 space-y-5 pb-2">
                      {events.map((ev) => (
                        <div key={ev.id} className="relative pl-6">
                          <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-sky-600 border-2 border-white ring-4 ring-sky-100" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{ev.type}</span>
                              {ev.actorRole && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                                  By {ev.actorRole}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {new Date(ev.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: CHAT */}
            {activeTab === 'CHAT' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 flex items-center gap-2 text-xs text-sky-800">
                  <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    Your chat is end-to-end pseudonymous. Handlers only see your pseudonym <strong>{complaint.pseudonym}</strong>.
                  </span>
                </div>

                {/* Message Scroll Container */}
                <div className="h-80 overflow-y-auto space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                      <div className="text-xs font-medium">No messages in this case yet.</div>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        If investigators require more evidence or clarify details, messages will appear here in real-time.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderType === 'COMPLAINANT';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              {isMe ? 'You (Complainant)' : `Staff Handler (${m.senderRole || 'Investigator'})`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                              isMe
                                ? 'bg-sky-700 text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                            }`}
                          >
                            {m.requestInfo && (
                              <div className="mb-1 text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Information Requested
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Composer */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send an anonymous message or reply to investigator..."
                    className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !chatInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {sendingMessage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
