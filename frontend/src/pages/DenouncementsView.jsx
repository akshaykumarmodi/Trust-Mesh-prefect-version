import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  AlertTriangle,
  Plus,
  ExternalLink,
  ShieldAlert,
  CheckCircle,
  RefreshCw,
  Clock,
  CheckCheck,
  XCircle,
  Filter,
} from 'lucide-react';

export default function DenouncementsView() {
  const [denouncements, setDenouncements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncWarning, setSyncWarning] = useState(null);
  const reqSeq = useRef(0);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Triage state
  const [triagingId, setTriagingId] = useState(null);
  const [triageStatus, setTriageStatus] = useState('Reviewed');
  const [triageNotes, setTriageNotes] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    contributor_username: '',
    reporting_project_id: '',
    reason: '',
    evidence_url: '',
    details: '',
  });

  const loadData = async () => {
    const seq = ++reqSeq.current;
    if (denouncements.length === 0) setLoading(true);

    try {
      const [dList, pList] = await Promise.all([
        api.getDenouncements(statusFilter !== 'ALL' ? statusFilter : null),
        api.getProjects(),
      ]);
      if (seq !== reqSeq.current) return;
      setDenouncements(Array.isArray(dList) ? dList : []);
      setProjects(Array.isArray(pList) ? pList : []);
      setError(null);
      setSyncWarning(null);

      if (pList.length > 0 && !formData.reporting_project_id) {
        setFormData((prev) => ({ ...prev, reporting_project_id: pList[0].id }));
      }
    } catch (err) {
      if (seq !== reqSeq.current) return;
      console.error('Failed to load denouncements:', err);
      if (denouncements.length === 0) {
        setError(err.message || 'Unable to retrieve reports from network.');
      } else {
        setSyncWarning(err.message || 'Network refresh failed. Preserving current reports.');
      }
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.contributor_username.trim()) {
      setErrorMsg('Contributor username is required.');
      return;
    }
    if (!formData.reporting_project_id) {
      setErrorMsg('Please select a reporting project.');
      return;
    }
    if (!formData.reason.trim()) {
      setErrorMsg('Reason for report is required.');
      return;
    }
    if (!formData.evidence_url.trim().startsWith('http')) {
      setErrorMsg('A valid evidence URL (https://...) is required to prevent unsubstantiated claims.');
      return;
    }

    try {
      setSubmitting(true);
      await api.submitDenouncement(formData);
      setSuccessMsg('Report lodged under "Pending Review". Allegations are not treated as proof.');
      setFormData({
        contributor_username: '',
        reporting_project_id: projects[0]?.id || '',
        reason: '',
        evidence_url: '',
        details: '',
      });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id) => {
    try {
      await api.updateDenouncementStatus(id, {
        status: triageStatus,
        review_notes: triageNotes,
        reviewed_by: 'maintainer-audit-lead',
      });
      setTriagingId(null);
      setTriageNotes('');
      await loadData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const statusBadges = {
    'Pending Review': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Under Investigation': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Reviewed: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    Dismissed: 'bg-slate-700/40 text-slate-400 border-slate-600 line-through',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Denouncements & Anomaly Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Transparent reporting system for suspicious behavior, sybil spam, and supply chain abuse.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-400 hover:to-amber-500 text-white font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(244,63,94,0.3)] flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Cancel' : 'Report Suspicious Activity'}</span>
        </button>
      </div>

      {/* Critical Fairness Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200">
          <span className="font-bold">CRITICAL FAIRNESS RULE: </span>
          An allegation is not proof. A report starts in 'Pending Review' and is discounted in peer evaluations until verified with transparent PR evidence. Reports can be dismissed by maintainers if unsubstantiated.
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-3 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Report Form */}
      {showForm && (
        <div className="glass-panel p-6 rounded-3xl border border-rose-500/30 bg-slate-900/90 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-4">
            <AlertTriangle className="w-4 h-4" />
            <span>Lodge an Evidence-Backed Report</span>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Target Contributor Username *
                </label>
                <input
                  type="text"
                  placeholder="e.g. slop-bot-99"
                  value={formData.contributor_username}
                  onChange={(e) =>
                    setFormData({ ...formData, contributor_username: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Reporting Project *
                </label>
                <select
                  value={formData.reporting_project_id}
                  onChange={(e) =>
                    setFormData({ ...formData, reporting_project_id: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Reason / Observed Pattern *
              </label>
              <input
                type="text"
                placeholder="e.g. Coordinated AI Slop: Mass spamming of trivial docstring edits across repos."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Evidence URL (PR, Commit, or Diff Link) *
              </label>
              <input
                type="url"
                placeholder="https://github.com/microsoft/vscode/pull/344157"
                value={formData.evidence_url}
                onChange={(e) => setFormData({ ...formData, evidence_url: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Detailed Explanation & Forensic Notes
              </label>
              <textarea
                rows="3"
                placeholder="Observed 8 identical pull requests opened within 5 minutes altering markdown comments with hallucinatory AI rephrasings."
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Report for Triage</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', 'Pending Review', 'Under Investigation', 'Reviewed', 'Dismissed'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-mono whitespace-nowrap transition-colors ${
              statusFilter === st
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Background Refresh Warning */}
      {syncWarning && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{syncWarning} Displaying currently loaded reports.</span>
          </div>
          <button
            onClick={() => setSyncWarning(null)}
            className="text-amber-400 hover:text-white text-xs font-mono px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Denouncements List */}
      {loading && denouncements.length === 0 ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : error && denouncements.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-rose-500/30 bg-rose-950/10 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Unable to Load Reports</h3>
          <p className="text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-lg shadow-rose-950/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : denouncements.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No reports have been submitted.</h3>
          <p className="text-xs text-slate-400 mt-1">Ecosystem supply chain integrity verified across federated repositories.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {denouncements.map((d) => (
            <div
              key={d.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-rose-500/30 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">@{d.contributor_username}</span>
                  <span className="text-xs text-slate-400">reported by</span>
                  <span className="text-xs font-semibold text-slate-200">{d.reporting_project_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono border ${statusBadges[d.status] || ''}`}>
                    {d.status}
                  </span>
                  <button
                    onClick={() => {
                      setTriagingId(triagingId === d.id ? null : d.id);
                      setTriageStatus(d.status);
                      setTriageNotes(d.review_notes || '');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
                  >
                    Triage &rarr;
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-medium">{d.reason}</p>
              {d.details && <p className="text-xs text-slate-400 leading-relaxed">{d.details}</p>}

              {d.review_notes && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-cyan-300 font-mono">
                  <span className="text-slate-500">Triage Note:</span> {d.review_notes}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                <a
                  href={d.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rose-400 hover:underline flex items-center gap-1"
                >
                  <span>Evidence URL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>Report ID: {d.id} • {new Date(d.created_at).toLocaleDateString()}</span>
              </div>

              {/* Maintainer Triage Inline Drawer */}
              {triagingId === d.id && (
                <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-cyan-500/30 text-xs space-y-3 animate-in fade-in">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>Maintainer Triage Action</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Update Status</label>
                      <select
                        value={triageStatus}
                        onChange={(e) => setTriageStatus(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                      >
                        <option value="Pending Review">Pending Review (Unverified)</option>
                        <option value="Under Investigation">Under Investigation</option>
                        <option value="Reviewed">Reviewed (Confirmed Anomaly)</option>
                        <option value="Dismissed">Dismissed (False Positive / Cleared)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Triage Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Cross-checked with DevPulse PR #142; confirmed identical script template."
                        value={triageNotes}
                        onChange={(e) => setTriageNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setTriagingId(null)}
                      className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(d.id)}
                      className="px-3.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs"
                    >
                      Save Triage Decision
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
