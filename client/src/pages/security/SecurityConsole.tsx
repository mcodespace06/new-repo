import { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  Radio, 
  MapPin, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  ExternalLink, 
  Plus, 
  Building2, 
  X,
  Phone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SosEventItem {
  id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  status: 'TRIGGERED' | 'DISPATCHED' | 'ACK' | 'RESPONDING' | 'RESOLVED' | 'FALSE_ALARM';
  dispatchedTo: any[];
  createdAt: string;
  user: {
    id: string;
    username: string;
    collegeEmail: string;
    phone?: string | null;
    department?: string | null;
  };
  pings?: { id: string; lat: number; lng: number; createdAt: string }[];
}

interface PoliceStationItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  lat: number;
  lng: number;
  active: boolean;
}

export default function SecurityConsole() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SosEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ALL' | 'STATIONS'>('ACTIVE');

  // Police stations
  const [stations, setStations] = useState<PoliceStationItem[]>([]);
  const [addStationOpen, setAddStationOpen] = useState(false);
  const [newStation, setNewStation] = useState({
    name: '',
    email: '',
    phone: '',
    lat: 19.0760,
    lng: 72.8777,
  });

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/security/sos', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStations = useCallback(async () => {
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/admin/police-stations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStations(data.stations || []);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchStations();

    // Setup Realtime SSE Listener for emergency distress beacons
    const eventSource = new EventSource('/api/security/sos/stream');

    eventSource.addEventListener('sos_triggered', () => {
      fetchEvents();
      // Play notification chime
      playAlertTone();
    });

    eventSource.addEventListener('sos_ping', () => {
      fetchEvents();
    });

    eventSource.addEventListener('sos_status_changed', () => {
      fetchEvents();
    });

    return () => {
      eventSource.close();
    };
  }, [fetchEvents, fetchStations]);

  const playAlertTone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {
      // ignore
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/security/sos/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchEvents();
      }
    } catch {
      alert('Failed to update emergency status.');
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/admin/police-stations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newStation),
      });
      if (res.ok) {
        setAddStationOpen(false);
        setNewStation({ name: '', email: '', phone: '', lat: 19.0760, lng: 72.8777 });
        fetchStations();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Creation failed');
      }
    } catch {
      alert('Network error');
    }
  };

  // Filter active events
  const activeEvents = events.filter((ev) => ['TRIGGERED', 'DISPATCHED', 'ACK', 'RESPONDING'].includes(ev.status));
  const displayedEvents = activeTab === 'ACTIVE' ? activeEvents : events;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-red-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>24/7 Campus Security & Emergency Command Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Security Incident Command
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Live distress beacon monitoring, patrol dispatching, and rapid police precinct coordination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-900">{user?.username}</div>
            <div className="text-[11px] text-red-600 font-bold uppercase">{user?.role}</div>
          </div>
          <button
            onClick={() => {
              fetchEvents();
              fetchStations();
            }}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'ACTIVE'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Active Distress Signals ({activeEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Historical Beacons ({events.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('STATIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'STATIONS'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Police Precincts Directory ({stations.length})</span>
          </button>
        </div>

        {activeTab === 'STATIONS' && user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => setAddStationOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Police Station</span>
          </button>
        )}
      </div>

      {/* BODY: Active or Historical Events */}
      {(activeTab === 'ACTIVE' || activeTab === 'ALL') && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-600" />
              <div className="text-xs text-slate-500 font-medium">Scanning live emergency beacon frequencies...</div>
            </div>
          ) : displayedEvents.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-white rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
              <div className="text-sm font-bold text-slate-800">No active distress beacons detected</div>
              <p className="text-xs text-slate-400">Campus perimeter is fully operational and calm.</p>
            </div>
          ) : (
            displayedEvents.map((ev) => {
              const isPending = ev.status === 'TRIGGERED' || ev.status === 'DISPATCHED';
              const isResponding = ev.status === 'RESPONDING';
              const isResolved = ev.status === 'RESOLVED';
              const isFalseAlarm = ev.status === 'FALSE_ALARM';

              return (
                <div
                  key={ev.id}
                  className={`p-5 rounded-3xl border-2 transition-all shadow-sm space-y-4 ${
                    isPending
                      ? 'bg-gradient-to-r from-red-50/90 via-white to-rose-50/50 border-red-500 animate-pulse'
                      : isResponding
                      ? 'bg-gradient-to-r from-amber-50/90 via-white to-orange-50/50 border-amber-500'
                      : isResolved
                      ? 'bg-white border-emerald-300 opacity-80'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Card Top */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
                        isPending ? 'bg-red-600' : isResponding ? 'bg-amber-600' : isResolved ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}>
                        <Radio className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900">{ev.user?.username || 'Student User'}</h3>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            isPending ? 'bg-red-600 text-white' :
                            isResponding ? 'bg-amber-500 text-white' :
                            isResolved ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {ev.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {ev.user?.collegeEmail} • Phone: <strong>{ev.user?.phone || 'Not registered'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400 font-medium">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(ev.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <span className="text-[10px]">{new Date(ev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Location & GPS Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="flex items-center gap-1.5 text-red-600">
                          <MapPin className="w-4 h-4" />
                          <span>GPS Coordinates</span>
                        </span>
                        <a
                          href={`https://maps.google.com/?q=${ev.lat},${ev.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-700 font-bold hover:underline flex items-center gap-1"
                        >
                          <span>Open Live Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="font-mono text-slate-700">
                        Lat: {ev.lat.toFixed(5)}, Lng: {ev.lng.toFixed(5)} (~{ev.accuracy || 15}m accuracy)
                      </p>
                      {ev.pings && ev.pings.length > 0 && (
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          Latest ping: {new Date(ev.pings[0].createdAt).toLocaleTimeString()} (Active location stream)
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5">
                      <div className="font-bold text-slate-800">Dispatched Notification Audit</div>
                      <p className="text-[11px] text-slate-600">
                        Alert sent to registered police/security contacts. Speed dial 112 active.
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Array.isArray(ev.dispatchedTo) && ev.dispatchedTo.map((d: any, idx: number) => (
                          <span key={idx} className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                            • {d.name} {d.distanceKm ? `(${d.distanceKm} km)` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Security Responder Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {ev.user?.phone && (
                        <a
                          href={`tel:${ev.user.phone}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Call Student</span>
                        </a>
                      )}
                      <a
                        href="tel:112"
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Direct 112</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isResolved && !isFalseAlarm && (
                        <>
                          {ev.status !== 'ACK' && ev.status !== 'RESPONDING' && (
                            <button
                              onClick={() => handleUpdateStatus(ev.id, 'ACK')}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors"
                            >
                              Acknowledge
                            </button>
                          )}
                          {ev.status !== 'RESPONDING' && (
                            <button
                              onClick={() => handleUpdateStatus(ev.id, 'RESPONDING')}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors"
                            >
                              Mark Responding (Unit Dispatched)
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(ev.id, 'RESOLVED')}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors"
                          >
                            Mark Resolved
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(ev.id, 'FALSE_ALARM')}
                            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                          >
                            False Alarm
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* BODY: Police Stations Directory */}
      {activeTab === 'STATIONS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stations.map((st) => (
              <div key={st.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{st.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Email: <strong className="text-slate-800">{st.email}</strong></div>
                  <div>Phone: <strong className="text-slate-800">{st.phone}</strong></div>
                  <div className="font-mono text-[11px] text-slate-400">
                    Coords: {st.lat.toFixed(4)}, {st.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Police Station Modal */}
      {addStationOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Register Police Precinct</h3>
              <button onClick={() => setAddStationOpen(false)} className="text-slate-400 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStation} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Station Name</label>
                <input
                  type="text"
                  required
                  value={newStation.name}
                  onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                  placeholder="e.g. South Campus Police Precinct"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dispatch Email</label>
                <input
                  type="email"
                  required
                  value={newStation.email}
                  onChange={(e) => setNewStation({ ...newStation, email: e.target.value })}
                  placeholder="e.g. ps.south@police.gov.in"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Phone</label>
                <input
                  type="text"
                  required
                  value={newStation.phone}
                  onChange={(e) => setNewStation({ ...newStation, phone: e.target.value })}
                  placeholder="e.g. +912226500400"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newStation.lat}
                    onChange={(e) => setNewStation({ ...newStation, lat: parseFloat(e.target.value) })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newStation.lng}
                    onChange={(e) => setNewStation({ ...newStation, lng: parseFloat(e.target.value) })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-sky-800"
                >
                  Save Precinct
                </button>
                <button
                  type="button"
                  onClick={() => setAddStationOpen(false)}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
