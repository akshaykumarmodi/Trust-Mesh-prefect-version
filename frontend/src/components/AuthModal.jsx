import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Key,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { api } from '../services/api';

const GitHubIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register' | 'admin_key'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [agreedPrivacy, setAgreedPrivacy] = useState(true);

  if (!isOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      localStorage.setItem('trustmesh_token', res.access_token);
      localStorage.setItem('trustmesh_user', JSON.stringify(res.user));
      setSuccessMsg(`Welcome back, ${res.user.name || res.user.email}!`);
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreedPrivacy) {
      setError('Please acknowledge the Activity Monitoring Notice to continue.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.register({ email, password, name });
      localStorage.setItem('trustmesh_token', res.access_token);
      localStorage.setItem('trustmesh_user', JSON.stringify(res.user));
      setSuccessMsg('Account registered successfully! Admin notification triggered.');
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const mockUser = 'octocat-engineer';
      const res = await api.githubLogin({ mock_username: mockUser });
      localStorage.setItem('trustmesh_token', res.access_token);
      localStorage.setItem('trustmesh_user', JSON.stringify(res.user));
      setSuccessMsg(`Authenticated as GitHub developer @${mockUser}!`);
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'GitHub OAuth login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminKeyAuth = (e) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setError('Please provide the Admin Master Key.');
      return;
    }
    localStorage.setItem('trustmesh_admin_key', adminKey.trim());
    const mockAdminUser = {
      id: 'usr-admin-key',
      email: 'akshay123modi@gmail.com',
      name: 'TrustMesh Administrator',
      is_admin: true,
      github_username: 'akshaymodi'
    };
    localStorage.setItem('trustmesh_user', JSON.stringify(mockAdminUser));
    setSuccessMsg('Admin Key authorized. Full monitoring access granted.');
    setTimeout(() => {
      onAuthSuccess(mockAdminUser);
      onClose();
    }, 600);
  };

  const fillAdminCredentials = () => {
    setEmail('akshay123modi@gmail.com');
    setPassword('AdminTrustMesh2026!');
    setMode('signin');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0a0f1d] border border-cyan-500/30 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">TrustMesh Authentication</h3>
              <p className="text-[11px] text-slate-400">Secure Activity-Monitored Access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-xl mt-4 border border-slate-800 text-xs">
          <button
            onClick={() => { setMode('signin'); setError(''); }}
            className={`py-2 rounded-lg font-medium transition-all ${
              mode === 'signin'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`py-2 rounded-lg font-medium transition-all ${
              mode === 'register'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            onClick={() => { setMode('admin_key'); setError(''); }}
            className={`py-2 rounded-lg font-medium transition-all ${
              mode === 'admin_key'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin Key
          </button>
        </div>

        {/* Alert banners */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@trustmesh.network"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to TrustMesh'}
            </button>

            {/* Quick Demo Fill for Admin */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={fillAdminCredentials}
                className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[10px]"
              >
                Auto-fill Admin Account (akshay123modi)
              </button>
            </div>

            <div className="relative py-2 flex items-center justify-center">
              <span className="h-px w-full bg-slate-800"></span>
              <span className="absolute px-2 bg-[#0a0f1d] text-[10px] text-slate-500 uppercase tracking-widest">
                or
              </span>
            </div>

            <button
              type="button"
              onClick={handleGitHubLogin}
              disabled={loading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <GitHubIcon className="w-4 h-4" />
              <span>Continue with GitHub Developer Account</span>
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@enterprise.io"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Privacy & Monitoring Notice Callout */}
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-[11px] text-cyan-200/90 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Transparent Activity Monitoring Disclosure</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                TrustMesh logs security and cryptographic operations (authentication, repository sync, vouches, denouncements) to prevent coordinated manipulation. Notifications are delivered to the network administrator (<span className="text-cyan-300 font-mono">akshay123modi@gmail.com</span>). Credentials and tokens are never stored or emailed.
              </p>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                />
                <span className="text-[10px] text-slate-300">I acknowledge the activity monitoring disclosure.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !agreedPrivacy}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Create Monitored Account'}
            </button>
          </form>
        )}

        {mode === 'admin_key' && (
          <form onSubmit={handleAdminKeyAuth} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Admin Master Key / Token</label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-cyan-400" />
                <input
                  type="password"
                  required
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="trustmesh_dev_master_key_2026"
                  className="w-full bg-slate-900/80 border border-cyan-500/40 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Authorizes direct administrative access via backend <span className="font-mono text-cyan-400">X-Admin-Key</span> header validation.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAdminKey('trustmesh_dev_master_key_2026')}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline block"
            >
              Use default development secret key
            </button>

            <button
              type="submit"
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              Authenticate Master Admin
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
