import { useEffect, useState } from 'react';
import { 
  Shield, 
  Lock, 
  AlertTriangle, 
  Search, 
  PhoneCall, 
  CheckCircle2, 
  UserCheck, 
  ArrowRight, 
  LogOut, 
  User as UserIcon, 
  X, 
  PlusCircle, 
  FolderHeart, 
  LayoutDashboard, 
  BookOpen, 
  Sparkles,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import NewComplaint from './pages/user/NewComplaint';
import TrackComplaint from './pages/public/TrackComplaint';
import MyComplaints from './pages/user/MyComplaints';
import AdminDashboard from './pages/admin/AdminDashboard';
import RulesLibrary from './pages/public/RulesLibrary';
import SecurityConsole from './pages/security/SecurityConsole';
import PolicyAssistantDrawer from './components/assistant/PolicyAssistantDrawer';
import SosEmergencyModal from './components/sos/SosEmergencyModal';

function MainApp() {
  const { user, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState<{ status: string; database?: string } | null>(null);
  const [authModal, setAuthModal] = useState<'LOGIN' | 'REGISTER' | null>(null);

  // App Page View State: 'HOME' | 'NEW_COMPLAINT' | 'TRACK' | 'MY_COMPLAINTS' | 'ADMIN' | 'RULES' | 'SECURITY'
  const [currentView, setCurrentView] = useState<'HOME' | 'NEW_COMPLAINT' | 'TRACK' | 'MY_COMPLAINTS' | 'ADMIN' | 'RULES' | 'SECURITY'>('HOME');
  const [trackKeyParam, setTrackKeyParam] = useState<string>('');

  // SOS Emergency Modal State
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  // AI Assistant Drawer State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data))
      .catch(() => setHealthStatus({ status: 'offline' }));
  }, []);

  const handleStartReport = () => {
    setCurrentView('NEW_COMPLAINT');
  };

  const handleTrackKey = (key: string) => {
    setTrackKeyParam(key);
    setCurrentView('TRACK');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Emergency Bar */}
      <div className="bg-slate-900 text-white px-4 py-2 text-xs sm:text-sm font-medium flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Official Campus Anonymous Grievance & Safety Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 hidden sm:inline text-[11px]">Emergency Distress:</span>
          <button
            type="button"
            onClick={() => setIsSosModalOpen(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
            <span>EMERGENCY SOS</span>
          </button>
          <a
            href="tel:112"
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors border border-slate-700"
          >
            <PhoneCall className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Call 112</span>
          </a>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('HOME')}
            className="flex items-center gap-3 text-left focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center font-bold text-lg shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-900 tracking-tight leading-none">CampusVoice</div>
              <div className="text-xs text-slate-500 font-medium">Anonymous & Safety Gateway</div>
            </div>
          </button>

          <nav className="flex items-center gap-2 sm:gap-5 text-sm font-medium">
            <button
              onClick={handleStartReport}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm ${
                currentView === 'NEW_COMPLAINT'
                  ? 'bg-sky-50 text-sky-700 font-bold'
                  : 'text-slate-600 hover:text-sky-700'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-sky-600" />
              <span>File Report</span>
            </button>

            <button
              onClick={() => {
                setTrackKeyParam('');
                setCurrentView('TRACK');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm ${
                currentView === 'TRACK'
                  ? 'bg-sky-50 text-sky-700 font-bold'
                  : 'text-slate-600 hover:text-sky-700'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Track Complaint</span>
            </button>

            <button
              onClick={() => setCurrentView('RULES')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm ${
                currentView === 'RULES'
                  ? 'bg-sky-50 text-sky-700 font-bold'
                  : 'text-slate-600 hover:text-sky-700'
              }`}
            >
              <BookOpen className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">Campus Rules</span>
            </button>

            {user && (user.role === 'STUDENT' || user.role === 'TEACHER') && (
              <button
                onClick={() => setCurrentView('MY_COMPLAINTS')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm ${
                  currentView === 'MY_COMPLAINTS'
                    ? 'bg-sky-50 text-sky-700 font-bold'
                    : 'text-slate-600 hover:text-sky-700'
                }`}
              >
                <FolderHeart className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">My Complaints</span>
              </button>
            )}

            {user && ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
              <button
                onClick={() => setCurrentView('ADMIN')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm ${
                  currentView === 'ADMIN'
                    ? 'bg-sky-50 text-sky-700 font-bold'
                    : 'text-slate-600 hover:text-sky-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-sky-700" />
                <span className="hidden sm:inline">Admin Console</span>
              </button>
            )}

            {user && ['SECURITY', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
              <button
                onClick={() => setCurrentView('SECURITY')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm ${
                  currentView === 'SECURITY'
                    ? 'bg-red-50 text-red-700 font-bold'
                    : 'text-slate-600 hover:text-red-700'
                }`}
              >
                <Radio className="w-4 h-4 text-red-600" />
                <span className="hidden sm:inline">Security Command</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  <UserIcon className="w-4 h-4 text-sky-700" />
                  <div className="text-left hidden sm:block">
                    <span className="text-xs font-bold text-slate-900 block leading-tight">{user.username}</span>
                    <span className="text-[10px] text-sky-700 font-semibold uppercase">{user.role}</span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <button
                  onClick={() => setAuthModal('LOGIN')}
                  className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-sky-700 hover:bg-slate-100 font-semibold transition-colors text-xs sm:text-sm"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthModal('REGISTER')}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-semibold transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Register</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Body Routing */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {currentView === 'NEW_COMPLAINT' && (
          <NewComplaint
            onBack={() => setCurrentView('HOME')}
            onTrackKey={(key) => handleTrackKey(key)}
          />
        )}

        {currentView === 'TRACK' && (
          <TrackComplaint
            initialKey={trackKeyParam}
            onBack={() => setCurrentView('HOME')}
          />
        )}

        {currentView === 'MY_COMPLAINTS' && (
          <MyComplaints
            onBack={() => setCurrentView('HOME')}
            onNewComplaint={() => setCurrentView('NEW_COMPLAINT')}
          />
        )}

        {currentView === 'RULES' && (
          <RulesLibrary
            onBack={() => setCurrentView('HOME')}
            onOpenAssistant={(q) => {
              setAssistantInitialQuery(q || '');
              setIsAssistantOpen(true);
            }}
            onFileComplaint={() => setCurrentView('NEW_COMPLAINT')}
          />
        )}

        {currentView === 'ADMIN' && (
          user && ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) ? (
            <AdminDashboard />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
              <p className="text-xs text-slate-500 mt-1 mb-4">Staff or Administrator credentials required.</p>
              <button onClick={() => setCurrentView('HOME')} className="px-4 py-2 bg-sky-700 text-white rounded-xl text-xs font-bold">Return Home</button>
            </div>
          )
        )}

        {currentView === 'SECURITY' && (
          user && ['SECURITY', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) ? (
            <SecurityConsole />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-slate-800">Security Clearance Required</h2>
              <p className="text-xs text-slate-500 mt-1 mb-4">Security Officer or Administrator credentials required for incident command.</p>
              <button onClick={() => setCurrentView('HOME')} className="px-4 py-2 bg-sky-700 text-white rounded-xl text-xs font-bold">Return Home</button>
            </div>
          )
        )}

        {currentView === 'HOME' && (
          <div className="space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-6 pt-4 sm:pt-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs sm:text-sm font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero-Knowledge Anonymity • Vault Schema Isolated</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Speak up safely without fear of retaliation.
              </h1>

              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                Report issues, harassment, or infrastructure failures completely anonymously. Your identity is cryptographically separated from your report, while our automated AI pipeline accelerates urgent assistance.
              </p>

              {user && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-left flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm">Authenticated as {user.username}</div>
                      <div className="text-xs text-emerald-700">
                        Role: <span className="font-semibold uppercase">{user.role}</span> {user.department ? `• Department: ${user.department}` : ''} • Verified Account
                      </div>
                    </div>
                  </div>
                  {['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) ? (
                    <button
                      onClick={() => setCurrentView('ADMIN')}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Open Admin Console</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentView('MY_COMPLAINTS')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                    >
                      View My Complaints
                    </button>
                  )}
                </div>
              )}

              {/* Quick Action Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">File a Complaint</h2>
                  <p className="text-sm text-slate-600 mb-5">
                    Choose between Confidential or Ultra-Anonymous reporting with proof uploads.
                  </p>
                  <button
                    onClick={handleStartReport}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 group-hover:text-sky-800"
                  >
                    Start Report <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                    <Search className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Track with Key</h2>
                  <p className="text-sm text-slate-600 mb-5">
                    Enter your <code>CV-YYMM-XXXX-XXXX</code> key to view real-time status and chat.
                  </p>
                  <button
                    onClick={() => {
                      setTrackKeyParam('');
                      setCurrentView('TRACK');
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800"
                  >
                    Lookup Case <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center mb-4">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-red-900 mb-1">Emergency SOS</h2>
                  <p className="text-sm text-red-700 mb-5">
                    One-tap GPS alert to Campus Security and nearby police stations.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSosModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 group-hover:text-red-900"
                  >
                    Activate Distress Beacon <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Architecture Explanations */}
            <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-sky-700" />
                Security & Anonymity Architecture (Phase 2 Active)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Zero Identity Storage
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The <code>complaints</code> database table contains zero user foreign keys or identifying columns. Admins see only pseudonyms like <code>Complainant #B9E4</code>.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    AES-256-GCM Vault Isolation
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Confidential reports store encrypted reporter links in an isolated PostgreSQL <code>vault</code> schema, inaccessible to case handlers and admin endpoints.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Crockford Base32 Keys
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Unique tracking keys (<code>CV-YYMM-XXXX-XXXX</code>) are generated once with checksum protection. The database stores only a salted SHA-256 hash.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Floating Emergency SOS Trigger */}
      <button
        type="button"
        onClick={() => setIsSosModalOpen(true)}
        className="fixed bottom-6 left-6 z-40 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm shadow-xl hover:shadow-2xl flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 group border-2 border-white/20"
      >
        <ShieldAlert className="w-4 h-4 animate-pulse text-white" />
        <span>EMERGENCY SOS</span>
      </button>

      {/* Floating AI Policy Assistant Trigger */}
      <button
        onClick={() => {
          setAssistantInitialQuery('');
          setIsAssistantOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-xl hover:shadow-2xl flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 group"
      >
        <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
        <span>Policy Assistant</span>
      </button>

      {/* AI Policy Assistant Drawer */}
      <PolicyAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onFileComplaint={() => {
          setIsAssistantOpen(false);
          setCurrentView('NEW_COMPLAINT');
        }}
        onTriggerSos={() => {
          setIsAssistantOpen(false);
          setIsSosModalOpen(true);
        }}
        initialQuery={assistantInitialQuery}
      />

      {/* Emergency SOS Modal (PRD §9 / ARCHITECTURE §9) */}
      <SosEmergencyModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
      />

      {/* Auth Modal Overlay */}
      {authModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setAuthModal(null)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {authModal === 'LOGIN' ? (
              <Login
                onSuccess={() => setAuthModal(null)}
                onNavigateToRegister={() => setAuthModal('REGISTER')}
              />
            ) : (
              <Register
                onSuccess={() => setAuthModal(null)}
                onNavigateToLogin={() => setAuthModal('LOGIN')}
              />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            CampusVoice Safety System • Phase 2 Complaints & Vault Active
          </div>
          <div className="flex items-center gap-3">
            <span>Server API:</span>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                healthStatus?.status === 'ok'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {healthStatus ? `${healthStatus.status} (DB: ${healthStatus.database || 'ready'})` : 'Connecting...'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
