import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  ArrowLeft, 
  Sparkles, 
  RefreshCw, 
  ChevronRight,
  PlusCircle,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RuleSummary {
  id: string;
  title: string;
  category: string;
  version: number;
  updatedBy: string;
  updatedAt: string;
  _count: { chunks: number; versions: number };
}

interface RuleDetail {
  id: string;
  title: string;
  category: string;
  bodyMd: string;
  version: number;
  updatedBy: string;
  updatedAt: string;
  versions: Array<{ id: string; version: number; changeNote: string; changedBy: string; createdAt: string }>;
  chunks: Array<{ id: string; sectionLabel: string }>;
}

interface RulesLibraryProps {
  onBack: () => void;
  onOpenAssistant: (initialQuery?: string) => void;
  onFileComplaint?: () => void;
}

export default function RulesLibrary({ onBack, onOpenAssistant }: RulesLibraryProps) {
  const { user } = useAuth();
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<RuleDetail | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Super Admin Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Disciplinary & Safety');
  const [editBody, setEditBody] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const res = await fetch(`/api/rules?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [categoryFilter, searchQuery]);

  const selectRule = async (id: string) => {
    setSelectedRuleId(id);
    setRuleLoading(true);
    try {
      const res = await fetch(`/api/rules/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRule(data.rule);
      }
    } catch {
      // ignore
    } finally {
      setRuleLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle || !editBody) return;

    setSavingRule(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          category: editCategory,
          bodyMd: editBody,
        }),
      });

      if (res.ok) {
        setIsEditorOpen(false);
        setEditTitle('');
        setEditBody('');
        fetchRules();
      }
    } catch {
      // ignore
    } finally {
      setSavingRule(false);
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>
          <div className="flex items-center gap-2 text-sky-800 text-xs font-bold uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Official University Statues & Student Rights Code</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Campus Rules Library</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse institutional regulations, anti-ragging mandates, hostel policies, and disciplinary bylaws.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenAssistant('What are the key campus rules?')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask Policy Assistant</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setIsEditorOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Policy</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search regulations by keyword..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="ALL">All Categories</option>
            <option value="Disciplinary & Safety">Disciplinary & Safety</option>
            <option value="Hostel Affairs">Hostel Affairs</option>
            <option value="Academic Integrity">Academic Integrity</option>
            <option value="IT & Infrastructure">IT & Infrastructure</option>
          </select>
        </div>
      </div>

      {/* Main Content: Split List and Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Document List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Policy Documents</h2>
          {loading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-sky-600 mb-2" />
              <div className="text-xs text-slate-500">Loading regulations...</div>
            </div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">No policy documents found</div>
              <p className="text-xs text-slate-400 mt-1">Try clearing filters or search terms.</p>
            </div>
          ) : (
            rules.map((r) => {
              const isSelected = selectedRuleId === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => selectRule(r.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-sky-50/80 border-sky-300 shadow-sm ring-1 ring-sky-300'
                      : 'bg-white border-slate-200 hover:border-sky-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {r.category}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-sky-700">v{r.version}</span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
                    {r.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                    <span>{r._count.chunks} sections indexed</span>
                    <div className="flex items-center gap-1 font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Read</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Document Reader (7 cols) */}
        <div className="lg:col-span-7">
          {ruleLoading ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
              <div className="text-xs text-slate-500">Loading document content...</div>
            </div>
          ) : selectedRule ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">
                      {selectedRule.category}
                    </span>
                    <span className="text-xs font-mono text-slate-500 font-semibold">
                      Version {selectedRule.version}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {selectedRule.title}
                  </h2>
                </div>

                <button
                  onClick={() => onOpenAssistant(`Explain the regulations in ${selectedRule.title}`)}
                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200 flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Ask Assistant About This</span>
                </button>
              </div>

              {/* Document Markdown Body */}
              <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed space-y-3 whitespace-pre-wrap bg-slate-50/50 p-6 rounded-2xl border border-slate-100 font-normal">
                {selectedRule.bodyMd}
              </div>

              {/* Indexed RAG Chunks Preview */}
              {selectedRule.chunks && selectedRule.chunks.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Indexed RAG Knowledge Clauses ({selectedRule.chunks.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRule.chunks.map((chk) => (
                      <span
                        key={chk.id}
                        className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200"
                      >
                        {chk.sectionLabel.split('›')[1]?.trim() || chk.sectionLabel}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Version History Log */}
              {selectedRule.versions && selectedRule.versions.length > 1 && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Revision History
                  </span>
                  <div className="space-y-1.5 text-xs">
                    {selectedRule.versions.map((ver) => (
                      <div key={ver.id} className="flex justify-between items-center text-slate-500 bg-slate-50 p-2 rounded-lg">
                        <span>v{ver.version}: {ver.changeNote || 'Standard Revision'}</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ver.createdAt).toLocaleDateString()} by {ver.changedBy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <div className="text-sm font-bold text-slate-700">Select a policy to view full text</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Click any document on the left to read clauses, verify rules, or query the AI assistant.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Super Admin Rule Creation Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Publish Campus Regulation</h3>
                <p className="text-xs text-slate-500">Will be automatically chunked and embedded for the RAG assistant.</p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Policy Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Laboratory Safety & Chemical Handling Guidelines"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 font-semibold bg-white"
                >
                  <option value="Disciplinary & Safety">Disciplinary & Safety</option>
                  <option value="Hostel Affairs">Hostel Affairs</option>
                  <option value="Academic Integrity">Academic Integrity</option>
                  <option value="IT & Infrastructure">IT & Infrastructure</option>
                  <option value="Student Welfare">Student Welfare</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Policy Text (Markdown with Headings)
                </label>
                <textarea
                  required
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="# Section 1: Scope&#10;Rules apply to all university students...&#10;&#10;## Section 2: Prohibited Conduct&#10;No unauthorized equipment..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Use # and ## headers. Each header will automatically generate a discrete RAG search chunk.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRule || !editTitle || !editBody}
                  className="px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingRule ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Publish & Ingest</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
