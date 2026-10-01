import React, { useState, useEffect } from 'react';
import { Shield, Lock, EyeOff, AlertCircle, Calendar, MapPin, Tag, UploadCloud, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TrackingKeyModal from '../../components/complaints/TrackingKeyModal';

interface Category {
  id: string;
  name: string;
  isSafety: boolean;
}

interface Location {
  id: string;
  name: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-academic', name: 'Academic', isSafety: false },
  { id: 'cat-infrastructure', name: 'Infrastructure', isSafety: false },
  { id: 'cat-hostel', name: 'Hostel', isSafety: false },
  { id: 'cat-canteen', name: 'Canteen', isSafety: false },
  { id: 'cat-transport', name: 'Transport', isSafety: false },
  { id: 'cat-harassment', name: 'Harassment', isSafety: true },
  { id: 'cat-ragging', name: 'Ragging', isSafety: true },
  { id: 'cat-discrimination', name: 'Discrimination', isSafety: true },
  { id: 'cat-cyberbullying', name: 'Cyber-bullying', isSafety: true },
  { id: 'cat-corruption', name: 'Corruption/Misconduct', isSafety: false },
  { id: 'cat-safety', name: 'Safety/Security', isSafety: true },
  { id: 'cat-mental', name: 'Mental-wellbeing', isSafety: true },
  { id: 'cat-other', name: 'Other', isSafety: false },
];

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'loc-admin', name: 'Main Administrative Block' },
  { id: 'loc-library', name: 'Central University Library' },
  { id: 'loc-science', name: 'Science & Engineering Complex' },
  { id: 'loc-hostel-north', name: 'North Campus Boys Hostel' },
  { id: 'loc-hostel-south', name: 'South Campus Girls Hostel' },
  { id: 'loc-canteen', name: 'University Cafeteria & Food Court' },
  { id: 'loc-sports', name: 'Indoor Sports & Gym Pavilion' },
  { id: 'loc-gate1', name: 'Main Entrance & Gate 1' },
];

interface NewComplaintProps {
  onBack: () => void;
  onTrackKey: (key: string) => void;
}

export default function NewComplaint({ onBack, onTrackKey }: NewComplaintProps) {
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 16));
  const [mode, setMode] = useState<'CONFIDENTIAL' | 'ULTRA_ANON'>(user ? 'CONFIDENTIAL' : 'ULTRA_ANON');
  const [description, setDescription] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [attachments, setAttachments] = useState<Array<{ fileKey: string; mime: string; size: number; name: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key display modal
  const [submittedData, setSubmittedData] = useState<{
    trackingKey: string;
    pseudonym: string;
    mode: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/complaints/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.categories && d.categories.length > 0) {
          setCategories(d.categories);
          setCategoryId(d.categories[0].id);
        }
      })
      .catch(() => setCategoryId(DEFAULT_CATEGORIES[0].id));

    fetch('/api/complaints/locations')
      .then((r) => r.json())
      .then((d) => {
        if (d.locations && d.locations.length > 0) {
          setLocations(d.locations);
          setLocationId(d.locations[0].id);
        }
      })
      .catch(() => setLocationId(DEFAULT_LOCATIONS[0].id));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must not exceed 5MB.');
      return;
    }

    const safeFileKey = `evidence/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    setAttachments((prev) => [
      ...prev,
      { fileKey: safeFileKey, mime: file.type || 'application/octet-stream', size: file.size, name: file.name },
    ]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (description.length < 20) {
      setError('Please provide at least 20 characters in the description.');
      return;
    }

    if (mode === 'CONFIDENTIAL' && !user) {
      setError('You must sign in to submit in Confidential mode, or select Ultra-Anonymous mode.');
      return;
    }

    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('cv_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          description,
          categoryId: categoryId || categories[0]?.id,
          locationId: locationId || locations[0]?.id,
          incidentAt: new Date(incidentDate).toISOString(),
          mode,
          targetEntityLabel: targetLabel || undefined,
          targetEntityType: targetLabel ? 'DEPARTMENT' : undefined,
          attachments: attachments.map(({ fileKey, mime, size }) => ({ fileKey, mime, size })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to file complaint.');
      }

      setSubmittedData({
        trackingKey: data.trackingKey,
        pseudonym: data.pseudonym,
        mode: data.mode,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10">
        <div className="border-b border-slate-100 pb-6 mb-6">
          <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            <span>Anonymous Grievance Intake</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">File a Grievance</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Your name and student ID are never saved in the complaints database. Choose your preferred anonymity mode below.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Anonymity Mode Selector (CMP-2) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              1. Anonymity Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Confidential Mode */}
              <div
                onClick={() => setMode('CONFIDENTIAL')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  mode === 'CONFIDENTIAL'
                    ? 'border-sky-600 bg-sky-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <Lock className="w-4 h-4 text-sky-700" />
                    <span>Confidential (Default)</span>
                  </div>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'CONFIDENTIAL'}
                    onChange={() => setMode('CONFIDENTIAL')}
                    className="accent-sky-700"
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Linked securely inside your isolated Vault. Visible in your "My Complaints" list. Admins still see only your pseudonym.
                </p>
                {!user && (
                  <span className="inline-block mt-2 text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                    Requires sign-in
                  </span>
                )}
              </div>

              {/* Ultra-Anonymous Mode */}
              <div
                onClick={() => setMode('ULTRA_ANON')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  mode === 'ULTRA_ANON'
                    ? 'border-sky-600 bg-sky-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <EyeOff className="w-4 h-4 text-slate-700" />
                    <span>Ultra-Anonymous</span>
                  </div>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'ULTRA_ANON'}
                    onChange={() => setMode('ULTRA_ANON')}
                    className="accent-sky-700"
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Zero vault rows. Zero database linkage. Completely untraceable even by root administrators. Trackable solely by key.
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Complaint Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken laboratory ventilation fan in Science Block room 302"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent font-medium"
            />
          </div>

          {/* Category & Campus Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent bg-white font-medium"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isSafety ? '🛡️ (Safety Priority)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campus Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent bg-white font-medium"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Incident Date & Target Entity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date & Time of Incident <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="datetime-local"
                  required
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Department or Entity Tag <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={targetLabel}
                  onChange={(e) => setTargetLabel(e.target.value)}
                  placeholder="e.g. Physics Department or North Mess"
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Detailed Incident Description <span className="text-red-500">*</span>
              </label>
              <span className={`text-[11px] ${description.length < 20 ? 'text-amber-600' : 'text-slate-400'}`}>
                {description.length} / 4000 (Min 20)
              </span>
            </div>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State what occurred, who was affected, and any specific times or contexts. Do not mention your own name if you wish to remain anonymous."
              className="w-full p-4 text-sm rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent leading-relaxed"
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Attach Evidence / Proof <span className="text-slate-400 font-normal">(Images, PDF - EXIF stripped automatically)</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-5 text-center bg-slate-50 hover:border-sky-500 transition-colors">
              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <input
                type="file"
                id="complaint-file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="complaint-file"
                className="text-xs font-bold text-sky-700 hover:text-sky-800 cursor-pointer"
              >
                Upload Photo or Document
              </label>
              <span className="text-[11px] text-slate-400 block mt-0.5">JPEG, PNG, WEBP, PDF up to 5MB</span>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 text-xs">
                    <span className="truncate max-w-[280px] font-medium text-slate-800">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Submitting & Generating Tracking Key...' : 'Submit Anonymous Grievance'}
          </button>
        </form>
      </div>

      {/* Tracking Key Modal */}
      {submittedData && (
        <TrackingKeyModal
          trackingKey={submittedData.trackingKey}
          pseudonym={submittedData.pseudonym}
          mode={submittedData.mode}
          onTrackNow={(key) => {
            setSubmittedData(null);
            onTrackKey(key);
          }}
          onClose={() => {
            setSubmittedData(null);
            onBack();
          }}
        />
      )}
    </div>
  );
}
