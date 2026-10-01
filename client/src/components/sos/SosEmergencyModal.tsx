import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  PhoneCall, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Radio, 
  MapPin, 
  ExternalLink 
} from 'lucide-react';

interface SosEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SosEmergencyModal({ isOpen, onClose }: SosEmergencyModalProps) {
  // Mode: 'TRIGGER' (selection) | 'COUNTDOWN' (10s cancel) | 'ACTIVE' (dispatched)
  const [phase, setPhase] = useState<'TRIGGER' | 'COUNTDOWN' | 'ACTIVE'>('TRIGGER');

  // 1. Hold-to-trigger state
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<any>(null);

  // 2. Triple-tap state
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<any>(null);

  // 3. Shake detection state
  const [shakeDetected, setShakeDetected] = useState(false);

  // Countdown timer state (10s)
  const [countdown, setCountdown] = useState(10);
  const countdownIntervalRef = useRef<any>(null);

  // Active SOS incident data
  const [sosId, setSosId] = useState<string | null>(null);
  const [sosStatus, setSosStatus] = useState<string>('DISPATCHED');
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number }>({ lat: 19.0760, lng: 72.8777 });
  const [nearestStations, setNearestStations] = useState<any[]>([]);
  const [pingCount, setPingCount] = useState(0);
  const pingIntervalRef = useRef<any>(null);

  // Play audio beep tone via Web Audio API
  const playBeep = useCallback((freq = 600, duration = 0.15) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext not allowed without gesture
    }
  }, []);

  // Shake detection listener
  useEffect(() => {
    if (!isOpen || phase !== 'TRIGGER') return;

    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const current = e.accelerationIncludingGravity;
      if (!current) return;

      const now = Date.now();
      if (now - lastTime > 100) {
        const diffTime = now - lastTime;
        lastTime = now;

        const x = current.x || 0;
        const y = current.y || 0;
        const z = current.z || 0;

        const speed = (Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime) * 10000;

        if (speed > 1200) {
          setShakeDetected(true);
          startCountdown();
        }

        lastX = x;
        lastY = y;
        lastZ = z;
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isOpen, phase]);

  // Handle Hold-to-trigger
  const startHold = () => {
    if (phase !== 'TRIGGER') return;
    setHoldProgress(0);
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / 3000) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        startCountdown();
      }
    }, 50);
  };

  const endHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  // Handle Triple Tap
  const handleTap = () => {
    if (phase !== 'TRIGGER') return;
    setTapCount((prev) => {
      const next = prev + 1;
      playBeep(440, 0.08);
      if (next >= 3) {
        clearTimeout(tapTimeoutRef.current);
        startCountdown();
        return 0;
      }
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        setTapCount(0);
      }, 1200);
      return next;
    });
  };

  // Step 2: Start 10-second cancel window
  const startCountdown = () => {
    setPhase('COUNTDOWN');
    setCountdown(10);
    playBeep(880, 0.3);

    // Fetch user coordinates immediately
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          // fallback to default campus coordinates
          setCoords({ lat: 19.0760, lng: 72.8777 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          dispatchSos();
          return 0;
        }
        playBeep(700, 0.1);
        return prev - 1;
      });
    }, 1000);
  };

  // User cancels within countdown window
  const handleCancelCountdown = async () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setPhase('TRIGGER');
    setCountdown(10);
    setHoldProgress(0);
    setTapCount(0);
  };

  // Step 3: Dispatch SOS to backend
  const dispatchSos = async () => {
    setPhase('ACTIVE');
    try {
      const token = localStorage.getItem('cv_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSosId(data.sos.id);
        setSosStatus(data.sos.status);
        setNearestStations(data.nearestStations || []);

        // Start periodic GPS pinging every 15s
        startPinging(data.sos.id);
      }
    } catch (err) {
      console.error('SOS dispatch error:', err);
    }
  };

  // Continuous location pinging
  const startPinging = (id: string) => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    pingIntervalRef.current = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const nextCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCoords({ ...nextCoords, accuracy: pos.coords.accuracy });
            setPingCount((c) => c + 1);

            try {
              await fetch(`/api/sos/${id}/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextCoords),
              });
            } catch {
              // ignore network ping drop
            }
          },
          () => {},
          { enableHighAccuracy: true }
        );
      }
    }, 15000);
  };

  // Stand-down / Resolve active emergency
  const handleResolveEmergency = async () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    if (sosId) {
      try {
        await fetch(`/api/sos/${sosId}/cancel`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Complainant reported safe / emergency resolved' }),
        });
      } catch {
        // ignore
      }
    }

    setPhase('TRIGGER');
    setSosId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl border-2 border-red-500/40 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-red-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <div>
              <h2 className="font-black text-base tracking-tight leading-none">Emergency SOS Gateway</h2>
              <span className="text-[11px] text-red-100 font-medium">Campus Protection & Quick Police Dispatch</span>
            </div>
          </div>
          {phase === 'TRIGGER' && (
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-red-700 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body based on Phase */}
        <div className="p-6 space-y-6">
          {/* PHASE 1: TRIGGER SELECTION */}
          {phase === 'TRIGGER' && (
            <div className="space-y-6 text-center">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Are you in immediate danger?</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Trigger an instantaneous distress call to campus security & nearest police precinct.
                </p>
              </div>

              {/* Trigger 1: Press and Hold Button */}
              <div className="py-2 flex flex-col items-center justify-center">
                <button
                  type="button"
                  onMouseDown={startHold}
                  onMouseUp={endHold}
                  onTouchStart={startHold}
                  onTouchEnd={endHold}
                  className="relative w-44 h-44 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-xl flex flex-col items-center justify-center select-none active:scale-95 transition-transform"
                >
                  {/* Circular hold progress stroke */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                    <circle
                      cx="88"
                      cy="88"
                      r="82"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="88"
                      cy="88"
                      r="82"
                      stroke="#ffffff"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray="515"
                      strokeDashoffset={515 - (515 * holdProgress) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-75"
                    />
                  </svg>

                  <ShieldAlert className="w-12 h-12 mb-1" />
                  <span className="font-black text-lg tracking-wider">HOLD SOS</span>
                  <span className="text-[11px] font-bold text-red-100">
                    {holdProgress > 0 ? `${Math.round(holdProgress)}%` : '3 Seconds'}
                  </span>
                </button>
                <span className="text-[11px] text-slate-400 mt-2 font-medium">Hold circle for 3s to activate</span>
              </div>

              {/* Trigger 2 & 3 Shortcuts */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTap}
                  className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">Triple-Tap</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                      {tapCount}/3
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Tap rapidly 3 times to trigger immediately</span>
                </button>

                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 text-left flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">Shake Sensor</span>
                    <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {shakeDetected ? 'Shake detected!' : 'Vigorously shake phone on mobile'}
                  </span>
                </div>
              </div>

              {/* Direct Speed Dial 112 Button */}
              <div className="pt-2 border-t border-slate-100">
                <a
                  href="tel:112"
                  className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <PhoneCall className="w-4 h-4 text-red-500" />
                  <span>Call 112 (Direct Police Hotline)</span>
                </a>
              </div>
            </div>
          )}

          {/* PHASE 2: 10-SECOND CANCEL COUNTDOWN */}
          {phase === 'COUNTDOWN' && (
            <div className="space-y-6 text-center py-4 animate-in zoom-in-95">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center font-black text-3xl animate-bounce">
                {countdown}
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Distress Dispatch In Progress</h3>
                <p className="text-xs text-red-600 font-bold uppercase tracking-wider">
                  Dispatching to Campus Security & Police in {countdown}s
                </p>
                <p className="text-xs text-slate-500">
                  Acquiring GPS coordinates ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})...
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelCountdown}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>I AM SAFE — CANCEL DISTRESS CALL</span>
              </button>

              <div className="text-[11px] text-slate-400">
                Accidental trigger? Tap cancel to abort without notifying authorities.
              </div>
            </div>
          )}

          {/* PHASE 3: ACTIVE EMERGENCY DISPATCH */}
          {phase === 'ACTIVE' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Alert Status Banner */}
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-800 font-black text-xs uppercase tracking-wider">
                    <Radio className="w-4 h-4 text-red-600 animate-ping" />
                    <span>Active Emergency Beacon Transmitting</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-200 text-red-900">
                    Status: {sosStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium">
                  Alert sent to registered police/security contacts. Speed dial 112 active.
                </p>
              </div>

              {/* Live Location Tracking Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <span>Live GPS Pings Active (every 15s)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Pings sent: {pingCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Coords: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                  <a
                    href={`https://maps.google.com/?q=${coords.lat},${coords.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>View on Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Nearest Police Stations */}
              {nearestStations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Dispatched Nearest Precincts:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {nearestStations.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-xs space-y-1">
                        <div className="font-bold text-slate-900 truncate">{item.station.name}</div>
                        <div className="text-[11px] text-red-700 font-semibold">{item.distanceKm} km away</div>
                        <a
                          href={`tel:${item.station.phone}`}
                          className="text-[11px] text-sky-700 font-bold hover:underline block pt-0.5"
                        >
                          Call {item.station.phone}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <a
                  href="tel:112"
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>CALL 112 (SPEED-DIAL HOTLINE)</span>
                </a>

                <button
                  type="button"
                  onClick={handleResolveEmergency}
                  className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-2xl transition-colors"
                >
                  I Am Now Safe (Stand Down Alert)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
