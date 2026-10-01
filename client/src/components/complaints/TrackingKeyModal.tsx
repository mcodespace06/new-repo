import { useState } from 'react';
import { Copy, Check, Download, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

interface TrackingKeyModalProps {
  trackingKey: string;
  pseudonym: string;
  mode: string;
  onTrackNow: (key: string) => void;
  onClose: () => void;
}

export default function TrackingKeyModal({
  trackingKey,
  pseudonym,
  mode,
  onTrackNow,
  onClose,
}: TrackingKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const content = `===================================================
CAMPUSVOICE — CONFIDENTIAL TRACKING CREDENTIALS
===================================================

Tracking Key : ${trackingKey}
Pseudonym    : ${pseudonym}
Mode         : ${mode}
Generated At : ${new Date().toLocaleString()}

IMPORTANT WARNING:
This tracking key is your ONLY method to track your complaint,
read replies from the administration, and send follow-up evidence.
CampusVoice stores only a cryptographic hash of this key;
it CANNOT be recovered if lost.

Keep this key secure and confidential.
===================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CampusVoice-Key-${trackingKey}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <ShieldCheck className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Complaint Submitted!</h2>
        <p className="text-xs text-slate-600 mt-1">
          Assigned Pseudonym: <strong className="text-sky-700">{pseudonym}</strong> • Mode: <span className="font-semibold uppercase">{mode}</span>
        </p>

        {/* Unmissable Tracking Key Box */}
        <div className="my-6 p-5 rounded-2xl bg-slate-900 text-white shadow-inner">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
            Your Unique Tracking Key
          </span>
          <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-sky-400 select-all py-1">
            {trackingKey}
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Key'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download (.txt)</span>
            </button>
          </div>
        </div>

        {/* Critical Persistence Warning */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-left text-xs space-y-1 mb-6">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            SHOWN ONLY ONCE — SAVE THIS KEY NOW
          </div>
          <p className="leading-relaxed">
            For security, the database stores only a cryptographic salted hash of this key. If you lose it, neither you nor the administrators can recover it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onTrackNow(trackingKey)}
            className="flex-1 py-3 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>Track Case Timeline</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
