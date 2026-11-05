import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  Plus,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  Hash,
  AlertCircle,
  FolderGit2,
} from 'lucide-react';

export default function VouchesView() {
  const [vouches, setVouches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    contributor_username: '',
    source_project_id: '',
    reason: '',
    evidence_url: '',
    context: '',
    confidence: 1.0,
  });

  const loadData = async (showLoadingSkeleton = true) => {
    try {
      if (showLoadingSkeleton) setLoading(true);
      const [vList, pList] = await Promise.all([api.getVouches(), api.getProjects()]);
      setVouches(vList);
      setProjects(pList);
      if (pList.length > 0) {
        setFormData((prev) => ({
          ...prev,
          source_project_id: prev.source_project_id || pList[0].id,
        }));
      }
    } catch (err) {
      console.error('Failed to load vouches:', err);
    } finally {
      if (showLoadingSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (submitting) return;

    setErrorMsg('');
    setSuccessMsg('');

    // Validation
    if (!formData.contributor_username.trim()) {
      setErrorMsg('Contributor username is required.');
      return;
    }
    if (!formData.source_project_id) {
      setErrorMsg('Please select a source project.');
      return;
    }
    if (!formData.reason.trim()) {
      setErrorMsg('Vouch reason is required.');
      return;
    }
    if (!formData.evidence_url.trim().startsWith('http')) {
      setErrorMsg('A valid supporting evidence URL (https://...) is required.');
      return;
    }

    try {
      setSubmitting(true);
      const newVouch = await api.submitVouch({
        ...formData,
        contributor_username: formData.contributor_username.trim(),
        reason: formData.reason.trim(),
        evidence_url: formData.evidence_url.trim(),
        context: formData.context.trim(),
        confidence: parseFloat(formData.confidence) || 1.0,
      });

      // Optimistically update list without tearing down the UI
      setVouches((prev) => {
        const filtered = prev.filter((v) => v.id !== newVouch.id);
        return [newVouch, ...filtered];
      });

      // Trigger celebratory micro-interaction
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#06b6d4', '#3b82f6'],
        });
      } catch {}

      setSuccessMsg(`Vouch recorded with Provenance Hash: ${newVouch.provenance_hash}`);
      setFormData({
        contributor_username: '',
        source_project_id: projects[0]?.id || '',
        reason: '',
        evidence_url: '',
        context: '',
        confidence: 1.0,
      });
      setShowForm(false);
      await loadData(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit vouch.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Peer Vouches
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Verified, attributable endorsements from peer open-source repositories with cryptographic provenance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Cancel' : 'Submit Peer Vouch'}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-400 hover:text-emerald-200 text-sm font-bold px-1"
          >
            &times;
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-400 hover:text-rose-200 text-sm font-bold px-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Vouch Form Modal / Accordion */}
      {showForm && (
        <div className="glass-panel p-6 rounded-3xl border border-emerald-500/30 bg-slate-900/90 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>Endorse a Contributor (Cryptographic Provenance Preserved)</span>
          </div>

          <form onSubmit={handleSubmit} action="#" method="POST" className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Contributor GitHub Username *
                </label>
                <input
                  type="text"
                  placeholder="e.g. elena-rustacean"
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
                  Source Project (Endorser) *
                </label>
                <select
                  value={formData.source_project_id}
                  onChange={(e) =>
                    setFormData({ ...formData, source_project_id: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Reason for Endorsement *
              </label>
              <input
                type="text"
                placeholder="e.g. Contributed high-throughput async ring buffer with 40% performance gain."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Supporting Evidence URL (PR or Commit) *
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/hyperflow-org/hyperflow/pull/412"
                  value={formData.evidence_url}
                  onChange={(e) => setFormData({ ...formData, evidence_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Confidence Score (0.0 to 1.0)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.0"
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Additional Technical Context (Optional)
              </label>
              <textarea
                rows="2"
                placeholder="Passed all deterministic concurrency fuzzing tests. Responsive to code review feedback."
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
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
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording Vouch...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Vouch</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vouches Table / Cards */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : vouches.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800">
          <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No endorsements yet.</h3>
          <p className="text-xs text-slate-400 mt-1">Record the first peer vouch to establish verified trust provenance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vouches.map((v) => (
            <div
              key={v.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">
                    @{v.contributor_username}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Endorsed by {v.source_project_name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(v.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{v.reason}</p>
                {v.context && <p className="text-[11px] text-slate-400 italic">{v.context}</p>}

                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono pt-1 text-slate-400">
                  <a
                    href={v.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>PR Evidence</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <span className="flex items-center gap-1 text-slate-500">
                    <Hash className="w-3 h-3" />
                    <span>Prov: {v.provenance_hash}</span>
                  </span>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {Math.round(v.confidence * 100)}% Confidence
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Peer Weight 1.0</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
