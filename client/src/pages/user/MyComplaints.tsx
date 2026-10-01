import { useState, useEffect } from 'react';
import { Shield, Clock, ArrowLeft, RefreshCw, FolderX } from 'lucide-react';

interface UserComplaint {
  id: string;
  title: string;
  status: string;
  priority: string;
  pseudonym: string;
  incidentAt: string;
  createdAt: string;
  resolvedAt?: string | null;
  category: { name: string };
  location: { name: string };
}

interface MyComplaintsProps {
  onBack: () => void;
  onNewComplaint: () => void;
  onSelectComplaint?: (id: string) => void;
}

export default function MyComplaints({ onBack, onNewComplaint }: MyComplaintsProps) {
  const [complaints, setComplaints] = useState<UserComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyComplaints = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/complaints/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.complaints || []);
      }
    } catch {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyComplaints();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              <span>Vault-Secured Repository</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">My Complaints</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Complaints submitted under Confidential mode linked to your account via isolated AES-256 vault encryption.
            </p>
          </div>
          <button
            onClick={onNewComplaint}
            className="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>+ New Report</span>
          </button>
        </div>

        {/* Complaints List */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            <span>Decrypting vault records...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderX className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No Confidential Complaints Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't filed any confidential complaints yet, or your past complaints were submitted in Ultra-Anonymous mode.
            </p>
            <button
              onClick={onNewComplaint}
              className="mt-2 text-xs font-bold text-sky-700 hover:text-sky-800 underline"
            >
              Submit your first grievance
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                      {c.category.name}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">• {c.location.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({c.pseudonym})</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-sky-700">Status: {c.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                    Priority: {c.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
