import { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ArrowUpDown, 
  MessageSquare, 
  FileText, 
  ChevronRight,
  UserCheck,
  ShieldAlert,
  CheckCheck,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CaseDetailModal from './CaseDetailModal';

interface CaseItem {
  id: string;
  pseudonym: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  mode: string;
  incidentAt: string;
  createdAt: string;
  resolvedAt?: string | null;
  category: { id: string; name: string };
  location: { id: string; name: string };
  assignedTo?: { id: string; name: string; email: string } | null;
  _count?: { messages: number; notes: number; attachments: number };
}

interface RiskAlertItem {
  id: string;
  type: string; // CRITICAL, PATTERN, RECURRENCE, SLA_BREACH
  complaintId?: string | null;
  message: string;
  recommendedActions: string[];
  status: string; // OPEN, ACKNOWLEDGED, RESOLVED
  createdAt: string;
  complaint?: {
    id: string;
    title: string;
    priority: string;
    status: string;
    pseudonym: string;
  } | null;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Risk Alerts state
  const [alerts, setAlerts] = useState<RiskAlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertStatusFilter, setAlertStatusFilter] = useState<'OPEN' | 'ALL'>('OPEN');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/alerts?status=${alertStatusFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch {
      // non-fatal
    } finally {
      setAlertsLoading(false);
    }
  }, [alertStatusFilter]);

  const handleUpdateAlertStatus = async (alertId: string, newStatus: 'ACKNOWLEDGED' | 'RESOLVED') => {
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch {
      alert('Failed to update alert status');
    }
  };

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cv_token');
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);

      const res = await fetch(`/api/admin/cases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Derived filtered list for text search
  const filteredCases = cases.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(query) ||
      c.pseudonym.toLowerCase().includes(query) ||
      c.category.name.toLowerCase().includes(query) ||
      c.location.name.toLowerCase().includes(query)
    );
  });

  // KPI Metrics Calculation
  const totalCount = cases.length;
  const submittedCount = cases.filter((c) => c.status === 'SUBMITTED' || c.status === 'TRIAGED').length;
  const inProgressCount = cases.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'NEEDS_INFO').length;
  const resolvedCount = cases.filter((c) => c.status === 'RESOLVED').length;
  const escalatedCount = cases.filter((c) => c.status === 'ESCALATED' || c.priority === 'CRITICAL').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'TRIAGED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'IN_PROGRESS':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'NEEDS_INFO':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ESCALATED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 font-bold';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 font-semibold';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 font-medium';
      default:
        return 'bg-slate-100 text-slate-700 font-normal';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Console Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-sky-800 text-xs font-bold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            <span>Campus Security & Case Management Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Admin Incident Console</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Triaging grievances, managing confidential communications, and tracking institutional resolution SLAs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-900">{user?.username}</div>
            <div className="text-[11px] text-sky-700 font-semibold uppercase">{user?.role}</div>
          </div>
          <button
            onClick={() => {
              fetchCases();
              fetchAlerts();
            }}
            disabled={loading || alertsLoading}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || alertsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* AI Risk & Threat Intelligence Panel (PRD §5 / ARCHITECTURE §7) */}
      <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-amber-50/50 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  Automated Threat & Risk Alert Stream
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {alerts.filter(a => a.status === 'OPEN').length} Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Real-time safety alerts generated by AI urgency signals, cluster surges, and threshold heuristics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs flex">
              <button
                type="button"
                onClick={() => setAlertStatusFilter('OPEN')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  alertStatusFilter === 'OPEN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Open Only
              </button>
              <button
                type="button"
                onClick={() => setAlertStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  alertStatusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All History
              </button>
            </div>
          </div>
        </div>

        {alertsLoading ? (
          <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
            <span>Scanning incident threat stream...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>No open threat or safety-floor alerts currently detected on campus.</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">All active cases within safe thresholds</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const isCritical = alert.type === 'CRITICAL';
              const isPattern = alert.type === 'PATTERN';
              const isResolved = alert.status === 'RESOLVED';
              const isAck = alert.status === 'ACKNOWLEDGED';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${
                    isResolved
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : isCritical
                      ? 'bg-white border-rose-200 hover:border-rose-400'
                      : isPattern
                      ? 'bg-white border-purple-200 hover:border-purple-400'
                      : 'bg-white border-amber-200 hover:border-amber-400'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-600 text-white'
                            : isPattern
                            ? 'bg-purple-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {alert.type}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          isResolved
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : isAck
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {alert.status}
                      </span>

                      <span className="text-[10px] text-slate-400">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>

                      {alert.complaint && (
                        <button
                          type="button"
                          onClick={() => setSelectedCaseId(alert.complaint!.id)}
                          className="font-mono text-[10px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1 transition-colors"
                        >
                          <span>{alert.complaint.pseudonym}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                    <p className="font-semibold text-slate-900 leading-snug">
                      {alert.message}
                    </p>

                    {alert.recommendedActions && Array.isArray(alert.recommendedActions) && alert.recommendedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {alert.recommendedActions.map((action, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200"
                          >
                            • {action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {alert.complaintId && (
                      <button
                        type="button"
                        onClick={() => setSelectedCaseId(alert.complaintId!)}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold border border-sky-200 transition-colors"
                      >
                        View Case
                      </button>
                    )}

                    {!isResolved && (
                      <>
                        {alert.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAlertStatus(alert.id, 'ACKNOWLEDGED')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 flex items-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3 text-amber-700" />
                            <span>Acknowledge</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUpdateAlertStatus(alert.id, 'RESOLVED')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold border border-emerald-200 flex items-center gap-1 transition-colors"
                        >
                          <CheckCheck className="w-3 h-3 text-emerald-700" />
                          <span>Resolve</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Total Active</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Across all categories</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
          <div className="flex items-center justify-between text-blue-700 text-xs font-medium mb-1">
            <span>Intake / Triage</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-900">{submittedCount}</div>
          <div className="text-[10px] text-blue-600 mt-1">Pending first action</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-sm bg-gradient-to-br from-white to-sky-50/40">
          <div className="flex items-center justify-between text-sky-700 text-xs font-medium mb-1">
            <span>In Progress</span>
            <UserCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-900">{inProgressCount}</div>
          <div className="text-[10px] text-sky-600 mt-1">Under active investigation</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm bg-gradient-to-br from-white to-purple-50/40">
          <div className="flex items-center justify-between text-purple-700 text-xs font-medium mb-1">
            <span>High / Escalated</span>
            <AlertTriangle className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-900">{escalatedCount}</div>
          <div className="text-[10px] text-purple-600 mt-1">Urgent attention needed</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium mb-1">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{resolvedCount}</div>
          <div className="text-[10px] text-emerald-600 mt-1">Confirmed closed</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, pseudonym, location..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="TRIAGED">TRIAGED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="NEEDS_INFO">NEEDS_INFO</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="REJECTED">REJECTED</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
      </div>

      {/* Case Incident Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <span>Incident Queue</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}
            </span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 font-medium">
            <ArrowUpDown className="w-3.5 h-3.5" /> Ordered by creation
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600" />
            <div className="text-xs text-slate-500 font-medium">Loading campus cases...</div>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Shield className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-sm font-bold text-slate-700">No cases found</div>
            <p className="text-xs text-slate-400">Try adjusting your search criteria or filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCases.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className="p-5 hover:bg-sky-50/40 transition-colors cursor-pointer group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                      {c.pseudonym}
                    </span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded border font-semibold ${getStatusBadge(c.status)}`}>
                      {c.status}
                    </span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${getPriorityBadge(c.priority)}`}>
                      {c.priority}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {c.category.name} • {c.location.name}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                    {c.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-1">
                    {c.description}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span>Incident: {new Date(c.incidentAt).toLocaleDateString()}</span>
                    <span>Reported: {new Date(c.createdAt).toLocaleDateString()}</span>
                    {c._count && (
                      <span className="flex items-center gap-2">
                        {c._count.messages > 0 && (
                          <span className="inline-flex items-center gap-1 text-sky-600 font-semibold">
                            <MessageSquare className="w-3 h-3" /> {c._count.messages}
                          </span>
                        )}
                        {c._count.notes > 0 && (
                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <FileText className="w-3 h-3" /> {c._count.notes}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCaseId(c.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <span>Manage</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Case Management Modal */}
      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onCaseUpdated={() => {
            fetchCases();
            fetchAlerts();
          }}
        />
      )}
    </div>
  );
}
