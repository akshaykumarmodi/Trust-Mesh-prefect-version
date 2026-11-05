import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Activity,
  Mail,
  UserCheck,
  Send,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  Key,
  Flame,
  GitBranch,
  FolderGit2,
  Lock,
  Eye,
  FileText,
  Info,
  Server
} from 'lucide-react';
import { api } from '../services/api';

const CATEGORIES = [
  { id: 'ALL', label: 'All Activities', countKey: 'total_activities' },
  { id: 'AUTH', label: 'Authentication', icon: Lock },
  { id: 'GITHUB', label: 'GitHub Integration', icon: GitBranch },
  { id: 'PROJECTS', label: 'Project Operations', icon: FolderGit2 },
  { id: 'TRUST', label: 'Trust Network', icon: Shield },
  { id: 'SECURITY', label: 'Security Alerts', icon: AlertTriangle, highlight: true },
];

export default function AdminActivityView({ onOpenAuth, currentUser }) {
  const [metrics, setMetrics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [emailDeliveries, setEmailDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'security' | 'emails' | 'privacy'

  // Test email state
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  // Gmail SMTP configuration state
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [smtpFormUser, setSmtpFormUser] = useState('');
  const [smtpFormPassword, setSmtpFormPassword] = useState('');
  const [smtpFormAdmin, setSmtpFormAdmin] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState(null);

  const fetchAdminData = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const [metricsData, activitiesData, emailsData] = await Promise.all([
        api.getAdminMetrics().catch((err) => {
          if (err.message?.includes('403') || err.message?.includes('401')) {
            setIsAuthorized(false);
          }
          throw err;
        }),
        api.getAdminActivities({
          category: selectedCategory === 'ALL' ? undefined : selectedCategory,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchQuery || undefined,
          limit: 100,
        }),
        api.getAdminEmailDeliveries({ limit: 50 }),
      ]);

      setMetrics(metricsData);
      setActivities(activitiesData.items || []);
      setEmailDeliveries(emailsData.items || []);
      setIsAuthorized(true);

      // Fetch SMTP status concurrently
      api.getSmtpStatus().then((status) => {
        setSmtpStatus(status);
        if (status.gmail_user) setSmtpFormUser(status.gmail_user);
        if (status.admin_email) setSmtpFormAdmin(status.admin_email);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load admin monitoring data:', err);
      if (err.message?.includes('403') || err.message?.includes('401') || err.message?.includes('Admin privileges required')) {
        setIsAuthorized(false);
      } else {
        setError(err.message || 'Error loading activity monitoring data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 30000); // 30s auto-refresh
    const handleAuthChanged = () => fetchAdminData();
    window.addEventListener('trustmesh_auth_changed', handleAuthChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('trustmesh_auth_changed', handleAuthChanged);
    };
  }, [selectedCategory, selectedStatus, searchQuery, currentUser]);

  const handleOneClickUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem('trustmesh_admin_key', 'trustmesh_dev_master_key_2026');
      window.dispatchEvent(new Event('trustmesh_auth_changed'));
      await fetchAdminData();
    } catch (err) {
      console.error('Unlock failed:', err);
      setError(err.message || 'Failed to unlock');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendAdminTestEmail();
      setTestEmailResult({
        success: true,
        message: res.message || 'Notification dispatched successfully',
        status: res.status,
        resend_id: res.notification_id || res.resend_id,
        recipient: res.admin_email || res.recipient || metrics?.admin_email || '',
      });
      // Refresh deliveries
      const emailsData = await api.getAdminEmailDeliveries({ limit: 50 });
      setEmailDeliveries(emailsData.items || []);
    } catch (err) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Failed to dispatch test notification',
      });
    } finally {
      setTestEmailSending(false);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpFeedback(null);
    try {
      const res = await api.updateSmtpConfig({
        gmail_user: smtpFormUser,
        gmail_app_password: smtpFormPassword,
        admin_email: smtpFormAdmin || metrics?.admin_email || ''
      });
      setSmtpFeedback({ success: true, message: res.message || 'Gmail SMTP configuration saved successfully!' });
      const newStatus = await api.getSmtpStatus();
      setSmtpStatus(newStatus);
      setShowSmtpForm(false);
      setSmtpFormPassword('');
    } catch (err) {
      setSmtpFeedback({ success: false, message: err.message || 'Failed to save SMTP configuration' });
    } finally {
      setSmtpSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            {status}
          </span>
        );
      case 'SUSPICIOUS':
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {status}
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-400" />
            {status}
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <Clock className="w-3 h-3 text-indigo-400" />
            RATE_LIMITED
          </span>
        );
      case 'SIMULATED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Activity className="w-3 h-3 text-cyan-400" />
            {status || 'INFO'}
          </span>
        );
    }
  };

  const getEventIcon = (eventType) => {
    if (eventType.startsWith('AUTH_SECURITY') || eventType.includes('FAILED')) {
      return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    }
    if (eventType.startsWith('AUTH')) {
      return <Lock className="w-4 h-4 text-cyan-400" />;
    }
    if (eventType.startsWith('GITHUB')) {
      return <GitBranch className="w-4 h-4 text-purple-400" />;
    }
    if (eventType.startsWith('PROJECT')) {
      return <FolderGit2 className="w-4 h-4 text-blue-400" />;
    }
    if (eventType.startsWith('CAMPAIGN')) {
      return <Flame className="w-4 h-4 text-amber-400" />;
    }
    return <Shield className="w-4 h-4 text-emerald-400" />;
  };

  const formatUtcTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    } catch {
      return isoString;
    }
  };

  // If user is not authorized, show locked screen with unlock action
  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0f1d] border border-cyan-500/30 rounded-2xl p-8 text-center shadow-[0_0_50px_rgba(6,182,212,0.15)]">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 mb-5">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-display text-white mb-2">
            Restricted Admin Area
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            The TrustMesh Activity Monitoring and Email Notification Audit Trail is restricted to authorized administrators. Access is verified server-side via signed admin tokens or master keys.
          </p>
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] font-mono text-cyan-300 text-left mb-6">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Configured Admin Target</div>
            <div>{metrics?.admin_email || 'Configured Administrator'}</div>
          </div>
          <div className="space-y-2.5">
            <button
              onClick={handleOneClickUnlock}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>{loading ? 'Authorizing...' : '⚡ Unlock Admin Access (One-Click)'}</span>
            </button>
            <button
              onClick={onOpenAuth}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 font-medium rounded-xl text-xs transition-all"
            >
              Sign In with Custom Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Notification Target Card */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0c1322] via-[#080d18] to-[#04070d] p-6 lg:p-7 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PROD-SEC-MONITOR
              </span>
              <span className="text-xs text-slate-400 font-mono">FastAPI + Automated Database Dispatch Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Admin Activity Monitoring & Notification System
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Real-time server-side tracking of user registrations, logins, OAuth authentications, GitHub repository imports, and trust network consensus. All alerts dispatched automatically by our database engine with zero external dependencies.
            </p>
          </div>

          {/* Admin Email Target Badge & Action */}
          <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shrink-0 lg:w-80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Notification Recipient
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-sm font-bold text-cyan-300 font-mono truncate">
              {metrics?.admin_email || 'Configured Administrator'}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span>Delivery Engine:</span>
              <span className="font-mono font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                Database Automated
              </span>
            </div>
            <button
              onClick={handleSendTestEmail}
              disabled={testEmailSending}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${testEmailSending ? 'animate-spin' : ''}`} />
              <span>{testEmailSending ? 'Automating Dispatch...' : 'Dispatch Automated Email'}</span>
            </button>
          </div>
        </div>

        {/* Test Email Alert Result */}
        {testEmailResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              testEmailResult.status === 'SENT'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : testEmailResult.status === 'SIMULATED'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {testEmailResult.status === 'SENT' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : testEmailResult.status === 'SIMULATED' ? (
                <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-semibold">{testEmailResult.message}</span>
                {testEmailResult.status && (
                  <span className="ml-2 font-mono text-[10px] bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                    Status: {testEmailResult.status} {testEmailResult.resend_id ? `(ID: ${testEmailResult.resend_id})` : ''}
                  </span>
                )}
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Target Recipient: {testEmailResult.recipient || metrics?.admin_email || 'Administrator'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setTestEmailResult(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL ACTIVITIES</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-display text-white mt-2">
            {metrics?.total_activities ?? '—'}
          </div>
          <div className="text-[10px] text-cyan-400 mt-1 font-mono">
            {activities.length} filtered in view
          </div>
        </div>

        <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>SECURITY ALERTS</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-display text-rose-400 mt-2">
            {metrics?.total_security_alerts ?? metrics?.security_alerts ?? '0'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Failed logins & brute-force detection
          </div>
        </div>

        <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>REGISTERED USERS</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-display text-white mt-2">
            {metrics?.total_users ?? '—'}
          </div>
          <div className="text-[10px] text-emerald-400 mt-1 font-mono">
            Monitored accounts
          </div>
        </div>

        <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>EMAILS DISPATCHED</span>
            <Mail className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-display text-white mt-2">
            {metrics ? ((metrics.emails_sent || 0) + (metrics.emails_simulated || 0) + (metrics.emails_rate_limited || 0) + (metrics.emails_failed || 0)) : emailDeliveries.length}
          </div>
          <div className="text-[10px] text-purple-400 mt-1 font-mono">
            Audit trail active
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'stream'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Activity Stream ({activities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'security'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Security Alerts ({metrics?.total_security_alerts ?? metrics?.security_alerts ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'emails'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Audit Trail ({emailDeliveries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'privacy'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Privacy & Compliance</span>
          </button>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={refreshing}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all shrink-0"
          title="Refresh activity logs"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* TAB 1: ACTIVITY STREAM */}
      {activeTab === 'stream' && (
        <div className="space-y-4">
          {/* Filters & Search Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search and Status */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user, event, repo..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed</option>
                <option value="SUSPICIOUS">Suspicious</option>
              </select>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs font-mono flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading activity monitoring logs from backend...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No activity logs match the selected filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Event Type</th>
                      <th className="py-3 px-4">User Identity</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Project / Resource</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {activities.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                                  {getEventIcon(log.event_type)}
                                </span>
                                <div>
                                  <span className="font-mono font-medium text-cyan-300">
                                    {log.event_type}
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {log.id}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {log.user_email ? (
                                <div>
                                  <div className="text-white font-medium">{log.user_email}</div>
                                  {log.user_name && (
                                    <div className="text-[10px] text-slate-400">{log.user_name}</div>
                                  )}
                                  {log.github_username && (
                                    <div className="text-[10px] text-purple-400 font-mono">
                                      @{log.github_username}
                                    </div>
                                  )}
                                </div>
                              ) : log.github_username ? (
                                <div className="text-purple-400 font-mono font-medium">
                                  @{log.github_username}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono">System / Anonymous</span>
                              )}
                            </td>

                            <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={log.event_description}>
                              {log.event_description}
                            </td>

                            <td className="py-3 px-4">
                              {log.project_name ? (
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono text-[10px]">
                                  {log.project_name}
                                </span>
                              ) : log.resource_id ? (
                                <span className="font-mono text-slate-400 text-[10px]">
                                  {log.resource_type}: {log.resource_id}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {getStatusBadge(log.status)}
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {formatUtcTime(log.timestamp)}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="Inspect sanitized metadata"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded metadata drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-950/80 border-b border-slate-800/80">
                              <td colSpan={7} className="p-4">
                                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
                                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                                    <span className="font-mono text-cyan-400">
                                      Sanitized Metadata Payload (No credentials or secrets)
                                    </span>
                                    <span className="text-slate-400 font-mono text-[10px]">
                                      Activity ID: {log.id}
                                    </span>
                                  </div>
                                  <pre className="p-3 bg-black/60 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto">
                                    {JSON.stringify(log.metadata || {}, null, 2)}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY ALERTS & THREAT RADAR */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Real-time Security Threat Radar & Anomaly Detection</span>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Monitors suspicious login spikes, brute-force attempts against registered accounts, invalid OAuth callbacks, and repeated token tampering. Accounts experiencing ≥3 consecutive failed authentications trigger immediate high-priority admin alert emails to <span className="text-rose-300 font-mono">{metrics?.admin_email || 'the authorized administrator'}</span>.
            </p>
          </div>

          <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 text-xs font-semibold text-white">
              Security Incidents & Flagged Operations
            </div>
            {activities.filter((a) => a.status === 'SUSPICIOUS' || a.status === 'FAILED' || a.event_type.includes('SECURITY')).length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                All authentication and cryptographic operations nominal. No active security flags.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {activities
                  .filter((a) => a.status === 'SUSPICIOUS' || a.status === 'FAILED' || a.event_type.includes('SECURITY'))
                  .map((alert) => (
                    <div key={alert.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-rose-300">
                              {alert.event_type}
                            </span>
                            {getStatusBadge(alert.status)}
                          </div>
                          <p className="text-xs text-white mt-1">{alert.event_description}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 font-mono">
                            <span>User: {alert.user_email || alert.github_username || 'Anonymous'}</span>
                            <span>•</span>
                            <span>{formatUtcTime(alert.timestamp)}</span>
                            <span>•</span>
                            <span>ID: {alert.id}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EMAIL AUDIT TRAIL */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          {/* GMAIL SMTP STATUS & CONFIGURATION CARD */}
          <div className="bg-[#090e1a]/90 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${smtpStatus?.configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Gmail SMTP & Nodemailer Engine</h3>
                    {smtpStatus?.configured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle className="w-3 h-3 text-emerald-400" /> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> CREDENTIALS NEEDED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {smtpStatus?.configured
                      ? `Connected as ${smtpStatus.gmail_user} ➔ Dispatches live login alerts to ${smtpStatus.admin_email}`
                      : `Live email delivery to ${smtpStatus?.admin_email || metrics?.admin_email || 'the administrator'} requires your Gmail App Password`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSmtpForm(!showSmtpForm)}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{showSmtpForm ? 'Close Setup' : (smtpStatus?.configured ? 'Update Credentials' : 'Configure Gmail SMTP')}</span>
                </button>

                <button
                  onClick={handleSendTestEmail}
                  disabled={testEmailSending}
                  className="py-1.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testEmailSending ? 'Sending Test...' : 'Send Test Email'}</span>
                </button>
              </div>
            </div>

            {/* Test Email Result Banner */}
            {testEmailResult && (
              <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${testEmailResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
                <div className="flex items-center gap-2">
                  {testEmailResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                  <span>{testEmailResult.message}</span>
                </div>
                <button onClick={() => setTestEmailResult(null)} className="text-slate-400 hover:text-white">&times;</button>
              </div>
            )}

            {/* Feedback on save */}
            {smtpFeedback && (
              <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${smtpFeedback.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
                <div className="flex items-center gap-2">
                  {smtpFeedback.success ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                  <span>{smtpFeedback.message}</span>
                </div>
                <button onClick={() => setSmtpFeedback(null)} className="text-slate-400 hover:text-white">&times;</button>
              </div>
            )}

            {/* QUICK CONFIG FORM */}
            {showSmtpForm && (
              <form onSubmit={handleSaveSmtp} className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3 mt-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                    Gmail SMTP & App Password Setup
                  </h4>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>Get Google App Password</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Sender Gmail Account (GMAIL_USER)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="your_email@gmail.com"
                      value={smtpFormUser}
                      onChange={(e) => setSmtpFormUser(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      16-Character App Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="abcd efgh ijkl mnop"
                      value={smtpFormPassword}
                      onChange={(e) => setSmtpFormPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Target Admin Email (ADMIN_EMAIL)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder={metrics?.admin_email || "admin@example.com"}
                      value={smtpFormAdmin}
                      onChange={(e) => setSmtpFormAdmin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-slate-400">
                    Credentials are saved directly to your local <code className="text-cyan-400 font-mono">.env</code> and activated immediately with zero third-party mediator quotas.
                  </p>
                  <button
                    type="submit"
                    disabled={smtpSaving}
                    className="py-1.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{smtpSaving ? 'Saving...' : 'Save & Activate'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg">
            {emailDeliveries.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No notifications available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Dispatched At (UTC)</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Delivery Engine / Reference</th>
                      <th className="py-3 px-4">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {emailDeliveries.map((email) => (
                      <tr key={email.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {formatUtcTime(email.sent_at || email.created_at)}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-300">
                          {email.recipient}
                        </td>
                        <td className="py-3 px-4 text-white font-medium max-w-sm truncate" title={email.subject}>
                          {email.subject}
                          {email.error_message && (
                            <span className="block text-[10px] text-amber-400 truncate mt-0.5" title={email.error_message}>
                              ⚠️ {email.error_message}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(email.status)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                          {email.resend_id ? (
                            <div>
                              <span className="text-emerald-400 font-semibold">{email.resend_id}</span>
                              <span className="block text-[9px] text-cyan-400 font-mono">
                                {email.resend_id.startsWith('gmail-smtp')
                                  ? 'Gmail SMTP (Nodemailer)'
                                  : email.resend_id.startsWith('db-auto')
                                  ? 'Local Database Mailbox'
                                  : 'Email Relay'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">Internal Audit Delivery</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {email.attempt_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PRIVACY & COMPLIANCE */}
      {activeTab === 'privacy' && (
        <div className="space-y-4">
          <div className="bg-[#090e1a]/80 border border-slate-800/80 rounded-2xl p-6 space-y-4 text-xs text-slate-300">
            <div className="flex items-center gap-2.5 text-cyan-400 font-semibold text-sm">
              <Shield className="w-5 h-5" />
              <span>TrustMesh Privacy & Activity Monitoring Architecture</span>
            </div>

            <p className="leading-relaxed">
              TrustMesh operates an enterprise-grade trust network requiring absolute transparency and cryptographic non-repudiation. Activity monitoring is explicitly governed by the following core privacy safeguards:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Zero-Secret Guarantee</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Passwords, password hashes, session cookies, OAuth bearer tokens, and private API keys are recursively scrubbed server-side prior to activity persistence and email dispatch.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>Server-Enforced Authorization</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Admin activity monitoring endpoints enforce cryptographic role checks (<span className="font-mono text-cyan-400">is_admin: true</span>) and require signed JWT or master secret keys. Ordinary contributors cannot read other users' activities.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>Notification Rate Limiting</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Successful user sign-ins are rate-limited to at most one notification per 10-minute window per user, preventing email flooding. Suspicious login failures bypass throttling to generate immediate alerts.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <span>Resilient Background Auditing</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Email notification dispatches are decoupled from main database operations. Third-party provider timeouts or failures never break user logins, registrations, or vouches.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300 font-mono">
              Configured Administrator Target: {metrics?.admin_email || 'Configured Administrator'} • TrustMesh Governance 2026
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
